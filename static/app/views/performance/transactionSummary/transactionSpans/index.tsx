import {useMemo} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {GlobalSelection, Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import {MutableSearch} from 'app/utils/tokenizeSearch';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import {getTransactionName} from '../../utils';

import SpansContent from './content';

type Props = RouteComponentProps<{}, {}> & {
  selection: GlobalSelection;
  organization: Organization;
  projects: Project[];
};

function TransactionSpans(props: Props) {
  const {organization, projects, location} = props;
  const transactionName = getTransactionName(location);

  const eventView = useMemo(() => {
    return generateSpansEventView(location, transactionName);
  }, [location]);

  if (!eventView || transactionName === undefined) {
    // If there is no transaction name, redirect to the Performance landing page
    browserHistory.replace({
      pathname: `/organizations/${organization.slug}/performance/`,
      query: {
        ...location.query,
      },
    });
    return null;
  }

  const shouldForceProject = eventView.project.length === 1;
  const forceProject = shouldForceProject
    ? projects.find(p => parseInt(p.id, 10) === eventView.project[0])
    : undefined;
  const projectSlugs = eventView.project
    .map(projectId => projects.find(p => parseInt(p.id, 10) === projectId))
    .filter((p: Project | undefined): p is Project => p !== undefined)
    .map(p => p.slug);

  const documentTitle = getDocumentTitle(location);

  return (
    <SentryDocumentTitle
      title={documentTitle}
      orgSlug={organization.slug}
      projectSlug={forceProject?.slug}
    >
      <Feature
        features={['organizations:performance-suspect-spans-view']}
        renderDisabled={NoAccess}
      >
        <GlobalSelectionHeader
          lockedMessageSubject={t('transaction')}
          shouldForceProject={shouldForceProject}
          forceProject={forceProject}
          specificProjectSlugs={projectSlugs}
          disableMultipleProjectSelection
          showProjectSettingsLink
        >
          <StyledPageContent>
            <LightWeightNoProjectMessage organization={organization}>
              <SpansContent
                location={location}
                organization={organization}
                projects={projects}
                transactionName={transactionName}
                eventView={eventView}
              />
            </LightWeightNoProjectMessage>
          </StyledPageContent>
        </GlobalSelectionHeader>
      </Feature>
    </SentryDocumentTitle>
  );
}

function generateSpansEventView(
  location: Location,
  transactionName: string | undefined
): EventView | undefined {
  if (transactionName === undefined) {
    return undefined;
  }

  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);
  // TODO: what should this event type be?
  conditions
    .setFilterValues('event.type', ['transaction'])
    .setFilterValues('transaction', [transactionName]);

  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields: ['count()'],
      query: conditions.formatString(),
      projects: [],
    },
    location
  );
}

function getDocumentTitle(location: Location): string {
  const name = getTransactionName(location);

  const hasTransactionName = typeof name === 'string' && String(name).trim().length > 0;

  if (hasTransactionName) {
    return [String(name).trim(), t('Performance')].join(' - ');
  }

  return [t('Summary'), t('Performance')].join(' - ');
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

function NoAccess() {
  return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
}

export default withGlobalSelection(withOrganization(withProjects(TransactionSpans)));
