import {Fragment} from 'react';
import {Location} from 'history';

import * as Layout from 'app/components/layouts/thirds';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';

import TransactionHeader from '../header';
import Tab from '../tabs';

type Props = {
  location: Location;
  organization: Organization;
  projects: Project[];
  transactionName: string;
  eventView: EventView;
};

function SpansContent(props: Props) {
  const {location, organization, projects, transactionName, eventView} = props;

  return (
    <Fragment>
      <TransactionHeader
        eventView={eventView}
        location={location}
        organization={organization}
        projects={projects}
        transactionName={transactionName}
        currentTab={Tab.Spans}
        hasWebVitals="maybe"
        handleIncompatibleQuery={() => {}}
      />
      <Layout.Body>
        <Layout.Main fullWidth>{null}</Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

export default SpansContent;
