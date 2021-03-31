import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import SearchBar from 'app/components/events/searchBar';
import {IconAdd, IconDelete} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';

import {DisplayType, WidgetQuery} from '../../../types';

type Props = {
  queries: WidgetQuery[];
  selectedProjectIds: number[];
  organization: Organization;
  displayType: DisplayType;
  onRemoveQuery: (index: number) => void;
  onAddQuery: () => void;
  onChangeQuery: (queryIndex: number, eventQuery: WidgetQuery) => void;
};

function Queries({
  queries,
  selectedProjectIds,
  organization,
  displayType,
  onRemoveQuery,
  onAddQuery,
  onChangeQuery,
}: Props) {
  function handleFieldChange(queryIndex: number, field: keyof WidgetQuery) {
    const widgetQuery = queries[queryIndex];

    return function handleChange(value: string) {
      const newQuery = {...widgetQuery, [field]: value};
      onChangeQuery(queryIndex, newQuery);
    };
  }

  function canAddNewQuery() {
    const rightDisplayType = [
      DisplayType.LINE,
      DisplayType.AREA,
      DisplayType.STACKED_AREA,
      DisplayType.BAR,
    ].includes(displayType);
    const underQueryLimit = queries.length < 3;

    return rightDisplayType && underQueryLimit;
  }

  const hideLegendAlias = [
    DisplayType.TABLE,
    DisplayType.WORLD_MAP,
    DisplayType.BIG_NUMBER,
  ].includes(displayType);

  return (
    <div>
      {queries.map((eventQuery, queryIndex) => {
        const displayDeleteButton = queries.length > 1;
        const displayLegendAlias = !hideLegendAlias;
        return (
          <Field
            key={queryIndex}
            inline={false}
            style={{paddingRight: 0}}
            flexibleControlStateSize
            stacked
          >
            <Fields
              displayDeleteButton={displayDeleteButton}
              displayLegendAlias={displayLegendAlias}
            >
              <SearchBar
                organization={organization}
                projectIds={selectedProjectIds}
                query={eventQuery.conditions}
                fields={[]}
                onSearch={handleFieldChange(queryIndex, 'conditions')}
                onBlur={handleFieldChange(queryIndex, 'conditions')}
                useFormWrapper={false}
              />
              {displayLegendAlias && (
                <Input
                  type="text"
                  name="name"
                  required
                  value={eventQuery.name}
                  placeholder={t('Legend Alias')}
                  onChange={event =>
                    handleFieldChange(queryIndex, 'name')(event.target.value)
                  }
                />
              )}
              {displayDeleteButton && (
                <Button
                  size="zero"
                  borderless
                  onClick={event => {
                    event.preventDefault();
                    onRemoveQuery(queryIndex);
                  }}
                  icon={<IconDelete />}
                  title={t('Remove query')}
                  label={t('Remove query')}
                />
              )}
            </Fields>
          </Field>
        );
      })}
      {canAddNewQuery() && (
        <Button
          size="small"
          icon={<IconAdd isCircled />}
          onClick={(event: React.MouseEvent) => {
            event.preventDefault();
            onAddQuery();
          }}
        >
          {t('Add Query')}
        </Button>
      )}
    </div>
  );
}

export default Queries;

const fieldsColumns = (p: {
  displayDeleteButton: boolean;
  displayLegendAlias: boolean;
}) => {
  if (!p.displayDeleteButton && !p.displayLegendAlias) {
    return '1fr';
  }

  if (!p.displayDeleteButton) {
    return '1fr 33%';
  }

  if (!p.displayLegendAlias) {
    return '1fr max-content';
  }

  return '1fr 33% max-content';
};

const Fields = styled('div')<{displayDeleteButton: boolean; displayLegendAlias: boolean}>`
  display: grid;
  grid-template-columns: ${fieldsColumns};
  grid-gap: ${space(1)};
  align-items: center;
`;
