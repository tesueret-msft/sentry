import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import MenuItem from 'app/components/menuItem';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {IconCheckmark} from 'app/icons/iconCheckmark';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {
  DynamicSamplingInnerName,
  DynamicSamplingRule,
  DynamicSamplingRules,
} from 'app/types/dynamicSampling';
import {defined} from 'app/utils';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import NumberField from 'app/views/settings/components/forms/numberField';

import ConditionFields from './conditionFields';
import handleXhrErrorResponse from './handleXhrErrorResponse';
import {isLegacyBrowser} from './utils';

type Conditions = React.ComponentProps<typeof ConditionFields>['conditions'];

type State = {
  conditions: Conditions;
  errors: {
    sampleRate?: string;
  };
  sampleRate?: number;
};

type Props = ModalRenderProps & {
  title: string;
  emptyMessage: string;
  conditionCategories: Array<[DynamicSamplingInnerName, string]>;
  api: Client;
  organization: Organization;
  project: Project;
  errorRules: DynamicSamplingRules;
  transactionRules: DynamicSamplingRules;
  onSubmitSuccess: (project: Project, successMessage: React.ReactNode) => void;
  onSubmit: (
    props: Omit<State, 'errors'> & {
      submitRules: (
        newRules: DynamicSamplingRules,
        currentRuleIndex: number
      ) => Promise<void>;
    }
  ) => void;
  onChange?: (props: State) => void;
  transactionField?: React.ReactElement;
  rule?: DynamicSamplingRule;
};

function RuleModal({
  Header,
  Body,
  Footer,
  closeModal,
  title,
  emptyMessage,
  conditionCategories,
  api,
  organization,
  project,
  errorRules,
  transactionRules,
  onSubmitSuccess,
  onSubmit,
  onChange,
  transactionField,
  rule,
}: Props) {
  const [data, setData] = useState<State>(getInitialState());

  useEffect(() => {
    if (!!data.errors.sampleRate) {
      setData({...data, errors: {...data.errors, sampleRate: undefined}});
    }
  }, [data.sampleRate]);

  useEffect(() => {
    onChange?.(data);
  }, [data]);

  function getInitialState(): State {
    if (rule) {
      const {condition: conditions, sampleRate} = rule as DynamicSamplingRule;

      const {inner} = conditions;

      return {
        conditions: inner.map(({name, value}) => {
          if (Array.isArray(value)) {
            if (isLegacyBrowser(value)) {
              return {
                category: name,
                legacyBrowsers: value,
              };
            }
            return {
              category: name,
              match: value.join('\n'),
            };
          }
          return {category: name};
        }),
        sampleRate: sampleRate * 100,
        errors: {},
      };
    }

    return {
      conditions: [],
      sampleRate: undefined,
      errors: {},
    };
  }

  function convertErrorXhrResponse(error: ReturnType<typeof handleXhrErrorResponse>) {
    switch (error.type) {
      case 'sampleRate':
        setErrors({...errors, sampleRate: error.message});
        break;
      default:
        addErrorMessage(error.message);
    }
  }

  async function submitRules(newRules: DynamicSamplingRules, currentRuleIndex: number) {
    try {
      const newProjectDetails = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {method: 'PUT', data: {dynamicSampling: {rules: newRules}}}
      );
      onSubmitSuccess(
        newProjectDetails,
        rule
          ? t('Successfully edited dynamic sampling rule')
          : t('Successfully added dynamic sampling rule')
      );
      closeModal();
    } catch (error) {
      convertErrorXhrResponse(handleXhrErrorResponse(error, currentRuleIndex));
    }
  }

  const {errors, conditions, sampleRate} = data;

  function handleAddCondition(category: DynamicSamplingInnerName) {
    setData({
      ...data,
      conditions: [
        ...conditions,
        {
          category,
          match: '',
        },
      ],
    });
  }

  const submitDisabled =
    !defined(sampleRate) ||
    (!!conditions.length &&
      !!conditions.find(condition => {
        if (condition.category === DynamicSamplingInnerName.EVENT_LEGACY_BROWSER) {
          return !(condition.legacyBrowsers ?? []).length;
        }

        if (
          condition.category === DynamicSamplingInnerName.EVENT_LOCALHOST ||
          condition.category === DynamicSamplingInnerName.EVENT_BROWSER_EXTENSIONS ||
          condition.category === DynamicSamplingInnerName.EVENT_WEB_CRAWLERS
        ) {
          return false;
        }

        return !condition.match;
      }));

  return (
    <Fragment>
      <Header closeButton>
        <h4>{title}</h4>
      </Header>
      <Body>
        <Fields>
          {transactionField}
          <Panel>
            <PanelHeader hasButtons>
              {t('Conditions')}
              <DropdownAutoComplete
                alignMenu="right"
                items={conditionCategories.map(conditionCategory => ({
                  value: conditionCategory[0],
                  label: (
                    <StyledMenuItem
                      onClick={event => {
                        event.preventDefault();
                        handleAddCondition(conditionCategory[0]);
                      }}
                    >
                      {conditionCategory[1]}
                    </StyledMenuItem>
                  ),
                }))}
              >
                {({isOpen}) => (
                  <DropdownButton isOpen={isOpen} size="small">
                    {t('Add Condition')}
                  </DropdownButton>
                )}
              </DropdownAutoComplete>
            </PanelHeader>
            <PanelBody>
              <EmptyMessage icon={<IconCheckmark isCircled size="xl" />}>
                {emptyMessage}
              </EmptyMessage>
            </PanelBody>
          </Panel>
          <NumberField
            label={`${t('Sampling Rate')} \u0025`}
            name="sampleRate"
            onChange={value => {
              setData({...data, sampleRate: defined(value) ? Number(value) : undefined});
            }}
            placeholder={'\u0025'}
            value={!sampleRate ? undefined : sampleRate}
            inline={false}
            hideControlState={!errors.sampleRate}
            error={errors.sampleRate}
            showHelpInTooltip
            stacked
            required
          />
        </Fields>
      </Body>
      <Footer>
        <ButtonBar gap={1}>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            priority="primary"
            onClick={() => onSubmit({conditions, sampleRate, submitRules})}
            disabled={submitDisabled}
          >
            {t('Save Rule')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

export default RuleModal;

const Fields = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
`;

const StyledMenuItem = styled(MenuItem)`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 400;
  text-transform: none;
  span {
    padding: 0;
  }
`;
