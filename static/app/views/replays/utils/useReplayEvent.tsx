import {useEffect, useState} from 'react';
import type {eventWithTime} from 'rrweb/typings/types';

import {IssueAttachment} from 'sentry/types';
import {Entry, EntryType, Event} from 'sentry/types/event';
import EventView from 'sentry/utils/discover/eventView';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

import mergeBreadcrumbsEntries from './mergeBreadcrumbsEntries';

function isReplayEventEntity(entry: Entry) {
  // Starting with an allowlist, might be better to block only a few types (like Tags)
  switch (entry.type) {
    case EntryType.SPANS:
      return true;
    default:
      return false;
  }
}
type State = {
  /**
   * List of breadcrumbs
   */
  breadcrumbEntry: undefined | Entry;

  /**
   * The root replay event
   */
  event: undefined | Event;

  /**
   * If any request returned an error then nothing is being returned
   */
  fetchError: undefined | RequestError;

  /**
   * If a fetch is underway for the requested root reply.
   * This includes fetched all the sub-resources like attachments and `sentry-replay-event`
   */
  fetching: boolean;

  mergedReplayEvent: undefined | Event;

  /**
   * The list of related `sentry-replay-event` objects that were captured during this `sentry-replay`
   */
  replayEvents: undefined | Event[];

  /**
   * The flattened list of rrweb events. These are stored as multiple attachments on the root replay object: the `event` prop.
   */
  rrwebEvents: undefined | eventWithTime[];
};

type Options = {
  /**
   * When provided, fetches specified replay event by slug
   */
  eventSlug: string;

  /**
   *
   */
  location: any;

  /**
   *
   */
  orgId: string;
};

interface Result extends State {}

const IS_RRWEB_ATTACHMENT_FILENAME = /rrweb-[0-9]{13}.json/;
function isRRWebEventAttachment(attachment: IssueAttachment) {
  return IS_RRWEB_ATTACHMENT_FILENAME.test(attachment.name);
}

function useReplayEvent({eventSlug, location, orgId}: Options): Result {
  const [projectId, eventId] = eventSlug.split(':');

  const api = useApi();
  const [state, setState] = useState<State>({
    fetchError: undefined,
    fetching: true,
    breadcrumbEntry: undefined,
    event: undefined,
    replayEvents: undefined,
    rrwebEvents: undefined,
    mergedReplayEvent: undefined,
  });

  function fetchEvent() {
    return api.requestPromise(
      `/organizations/${orgId}/events/${eventSlug}/`
    ) as Promise<Event>;
  }

  async function fetchRRWebEvents() {
    const attachmentIds = (await api.requestPromise(
      `/projects/${orgId}/${projectId}/events/${eventId}/attachments/`
    )) as IssueAttachment[];
    const rrwebAttachmentIds = attachmentIds.filter(isRRWebEventAttachment);
    const attachments = await Promise.all(
      rrwebAttachmentIds.map(async attachment => {
        const response = await api.requestPromise(
          `/api/0/projects/${orgId}/${projectId}/events/${eventId}/attachments/${attachment.id}/?download`
        );
        return JSON.parse(response).events as eventWithTime;
      })
    );
    return attachments.flat();
  }

  async function fetchReplayEvents() {
    const replayEventsView = EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: ['timestamp', 'replayId'],
      orderby: 'timestamp',
      projects: [],
      range: '14d',
      query: `transaction:sentry-replay-event`,
    });
    replayEventsView.additionalConditions.addFilterValues('replayId', [eventId]);
    const replayEventsQuery = replayEventsView.getEventsAPIPayload(location);

    const replayEventList = await api.requestPromise(
      `/organizations/${orgId}/eventsv2/`,
      {
        query: replayEventsQuery,
      }
    );

    return Promise.all(
      replayEventList.data.map(
        event =>
          api.requestPromise(
            `/organizations/${orgId}/events/${generateEventSlug(event)}/`
          ) as Promise<Event>
      )
    );
  }

  async function loadEvents() {
    setState({
      fetchError: undefined,
      fetching: true,

      breadcrumbEntry: undefined,
      event: undefined,
      replayEvents: undefined,
      rrwebEvents: undefined,
      mergedReplayEvent: undefined,
    });
    try {
      const [event, rrwebEvents, replayEvents] = await Promise.all([
        fetchEvent(),
        fetchRRWebEvents(),
        fetchReplayEvents(),
      ]);

      const breadcrumbEntry = mergeBreadcrumbsEntries(replayEvents || []);

      // Get a merged list of all spans from all replay events
      const spans = replayEvents.flatMap(
        replayEvent => replayEvent.entries.find(isReplayEventEntity).data
      );

      // Create a merged spans entry on the first replay event and fake the
      // endTimestamp by using the timestamp of the final span
      const mergedReplayEvent = {
        ...replayEvents[0],
        breakdowns: null,
        entries: [{type: EntryType.SPANS, data: spans}],
        // This is probably better than taking the end timestamp of the last `replayEvent`
        endTimestamp: spans[spans.length - 1]?.timestamp,
      };

      setState({
        ...state,
        fetchError: undefined,
        fetching: false,
        event,
        mergedReplayEvent,
        replayEvents,
        rrwebEvents,
        breadcrumbEntry,
      });
    } catch (error) {
      setState({
        fetchError: error,
        fetching: false,

        breadcrumbEntry: undefined,
        event: undefined,
        replayEvents: undefined,
        rrwebEvents: undefined,
        mergedReplayEvent: undefined,
      });
    }
  }

  useEffect(() => void loadEvents(), [orgId, eventSlug]);

  return {
    fetchError: state.fetchError,
    fetching: state.fetching,

    breadcrumbEntry: state.breadcrumbEntry,
    event: state.event,
    replayEvents: state.replayEvents,
    rrwebEvents: state.rrwebEvents,
    mergedReplayEvent: state.mergedReplayEvent,
  };
}

export default useReplayEvent;
