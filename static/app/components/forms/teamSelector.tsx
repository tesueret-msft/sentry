import {useEffect, useRef, useState} from 'react';
import {StylesConfig} from 'react-select';
import styled from '@emotion/styled';

import {addTeamToProject} from 'app/actionCreators/projects';
import Button from 'app/components/button';
import SelectControl, {ControlProps} from 'app/components/forms/selectControl';
import IdBadge from 'app/components/idBadge';
import Tooltip from 'app/components/tooltip';
import {IconAdd, IconUser} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project, Team} from 'app/types';
import useApi from 'app/utils/useApi';
import withOrganization from 'app/utils/withOrganization';
import withTeams from 'app/utils/withTeams';

const UnassignedWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledIconUser = styled(IconUser)`
  margin-left: ${space(0.25)};
  margin-right: ${space(1)};
  color: ${p => p.theme.gray400};
`;

// An option to be unassigned on the team dropdown
const unassignedOption = {
  value: null,
  label: (
    <UnassignedWrapper>
      <StyledIconUser size="20px" />
      {t('Unassigned')}
    </UnassignedWrapper>
  ),
  searchKey: 'unassigned',
  actor: null,
  disabled: false,
};

// Ensures that the svg icon is white when selected
const unassignedSelectStyles: StylesConfig = {
  option: (provided, state) => ({
    ...provided,
    svg: {
      color: state.isSelected && state.theme.white,
    },
  }),
};

const placeholderSelectStyles: StylesConfig = {
  input: (provided, state) => ({
    ...provided,
    display: 'grid',
    gridTemplateColumns: 'max-content 1fr',
    alignItems: 'center',
    gridGap: space(1),
    ':before': {
      backgroundColor: state.theme.backgroundSecondary,
      height: 24,
      width: 24,
      borderRadius: 3,
      content: '""',
      display: 'block',
    },
  }),
  placeholder: provided => ({
    ...provided,
    paddingLeft: 32,
  }),
};

type Props = {
  organization: Organization;
  teams: Team[];
  onChange: (value: any) => any;
  /**
   * Function to control whether a team should be shown in the dropdown
   */
  teamFilter?: (team: Team) => boolean;
  /**
   * Can be used to restrict teams to a certain project and allow for new teams to be add to that project
   */
  project?: Project;
  /**
   * Controls whether the value in the dropdown is a team id or team slug
   */
  useId?: boolean;
  includeUnassigned?: boolean;
} & ControlProps;

type TeamActor = {
  type: 'team';
  id: string;
  name: string;
};

type TeamOption = {
  value: string | null;
  label: React.ReactElement;
  searchKey: string;
  actor: TeamActor | null;
  disabled?: boolean;
};

function TeamSelector(props: Props) {
  const {includeUnassigned, styles, ...extraProps} = props;
  const {teams, teamFilter, organization, project, multiple, value, useId, onChange} =
    props;

  const api = useApi();
  const [options, setOptions] = useState<TeamOption[]>([]);

  // TODO(ts) This type could be improved when react-select types are better.
  const selectRef = useRef<any>(null);

  const createTeamOption = (team: Team): TeamOption => ({
    value: useId ? team.id : team.slug,
    label: <IdBadge team={team} />,
    searchKey: `#${team.slug}`,
    actor: {
      type: 'team',
      id: team.id,
      name: team.slug,
    },
  });

  /**
   * Closes the select menu by blurring input if possible since that seems to
   * be the only way to close it.
   */
  function closeSelectMenu() {
    if (!selectRef.current) {
      return;
    }

    const select = selectRef.current.select;
    const input: HTMLInputElement = select.inputRef;

    if (input) {
      // I don't think there's another way to close `react-select`
      input.blur();
    }
  }

  async function handleAddTeamToProject(team: Team) {
    if (!project) {
      closeSelectMenu();
      return;
    }

    // Copy old value
    const oldValue = multiple ? [...(value ?? [])] : {value};
    // Optimistic update
    onChange?.(createTeamOption(team));

    try {
      await addTeamToProject(api, organization.slug, project.slug, team);

      // Remove add to project button without changing order
      const newOptions = options.map(option => {
        if (option.actor?.id === team.id) {
          option.disabled = false;
          option.label = <IdBadge team={team} />;
        }

        return option;
      });

      setOptions(newOptions);
    } catch (err) {
      // Unable to add team to project, revert select menu value
      onChange?.(oldValue);
    }

    closeSelectMenu();
  }

  function createTeamOutsideProjectOption(team: Team): TeamOption {
    const canAddTeam = organization.access.includes('project:write');

    return {
      ...createTeamOption(team),
      disabled: true,
      label: (
        <TeamOutsideProject>
          <DisabledLabel>
            <Tooltip
              position="left"
              title={t('%s is not a member of project', `#${team.slug}`)}
            >
              <IdBadge team={team} />
            </Tooltip>
          </DisabledLabel>
          <Tooltip
            title={
              canAddTeam
                ? t('Add %s to project', `#${team.slug}`)
                : t('You do not have permission to add team to project.')
            }
          >
            <AddToProjectButton
              type="button"
              size="zero"
              borderless
              disabled={!canAddTeam}
              onClick={() => handleAddTeamToProject(team)}
              icon={<IconAdd isCircled />}
            />
          </Tooltip>
        </TeamOutsideProject>
      ),
    };
  }

  function getInitialOptions() {
    const filteredTeams = teamFilter ? teams.filter(teamFilter) : teams;

    if (project) {
      const teamsInProjectIdSet = new Set(project.teams.map(team => team.id));
      const teamsInProject = filteredTeams.filter(team =>
        teamsInProjectIdSet.has(team.id)
      );
      const teamsNotInProject = filteredTeams.filter(
        team => !teamsInProjectIdSet.has(team.id)
      );

      return [
        ...teamsInProject.map(createTeamOption),
        ...teamsNotInProject.map(createTeamOutsideProjectOption),
        ...(includeUnassigned ? [unassignedOption] : []),
      ];
    }

    return [
      ...filteredTeams.map(createTeamOption),
      ...(includeUnassigned ? [unassignedOption] : []),
    ];
  }

  useEffect(
    () => void setOptions(getInitialOptions()),
    [teams, teamFilter, project, includeUnassigned]
  );

  return (
    <SelectControl
      ref={selectRef}
      options={options}
      isOptionDisabled={option => !!option.disabled}
      styles={{
        ...(styles ?? {}),
        ...(includeUnassigned ? unassignedSelectStyles : {}),
        ...placeholderSelectStyles,
      }}
      {...extraProps}
    />
  );
}

const TeamOutsideProject = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
`;

const DisabledLabel = styled('div')`
  display: flex;
  opacity: 0.5;
  overflow: hidden; /* Needed so that "Add to team" button can fit */
`;

const AddToProjectButton = styled(Button)`
  flex-shrink: 0;
`;

export {TeamSelector};

// TODO(davidenwang): this is broken due to incorrect types on react-select
export default withTeams(withOrganization(TeamSelector)) as unknown as (
  p: Omit<Props, 'teams' | 'organization'>
) => JSX.Element;