import type { JSX } from 'preact'
import type { AccountKind } from '../../engine/types'
import type { ExpenseItemState, IncomeItemState, LumpSumItemState } from '../state'
import { Checkbox, NumberField, SelectField, TextField } from './Field'

/**
 * Repeatable-row editors for the three list-shaped scenario fields: extra
 * income streams, irregular expenses, and one-time amounts. Unlike accounts
 * or pensions, these have no natural "one per person" shape — a household
 * might have zero of these or five, so the form has to support add/remove
 * rather than a fixed set of fields.
 */

function RemoveButton({ onClick }: { onClick: () => void }): JSX.Element {
  return (
    <button type="button" class="repeat-remove" onClick={onClick} aria-label="Remove">
      ×
    </button>
  )
}

interface IncomeFieldsProps {
  items: IncomeItemState[]
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<IncomeItemState>) => void
  onRemove: (id: string) => void
}

export function IncomeFields({ items, onAdd, onUpdate, onRemove }: IncomeFieldsProps): JSX.Element {
  return (
    <div class="repeat-list">
      {items.map((item) => (
        <div class="repeat-item" key={item.id}>
          <div class="repeat-item-header">
            <TextField
              label="What is it?"
              value={item.label}
              placeholder="e.g. Rental income, part-time work, royalties"
              onChange={(label) => onUpdate(item.id, { label })}
            />
            <RemoveButton onClick={() => onRemove(item.id)} />
          </div>
          <div class="field-grid">
            <NumberField label="Annual amount" value={item.annual} step={500} prefix="$"
              onChange={(n) => onUpdate(item.id, { annual: n })} />
            <NumberField label="Starts at age" value={item.startAge} min={18} max={105}
              onChange={(n) => onUpdate(item.id, { startAge: n })} />
          </div>
          <Checkbox
            label="Ends at a specific age"
            checked={item.hasEndAge}
            onChange={(hasEndAge) => onUpdate(item.id, { hasEndAge })}
          />
          {item.hasEndAge && (
            <NumberField label="Ends at age" value={item.endAge} min={item.startAge} max={105}
              onChange={(n) => onUpdate(item.id, { endAge: n })} />
          )}
          <Checkbox
            label="Keeps pace with inflation"
            checked={item.inflationAdjusted}
            onChange={(inflationAdjusted) => onUpdate(item.id, { inflationAdjusted })}
          />
          <Checkbox
            label="Taxable"
            checked={item.taxable}
            onChange={(taxable) => onUpdate(item.id, { taxable })}
          />
        </div>
      ))}
      <button type="button" class="repeat-add" onClick={onAdd}>
        + Add income
      </button>
    </div>
  )
}

interface ExpenseFieldsProps {
  items: ExpenseItemState[]
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<ExpenseItemState>) => void
  onRemove: (id: string) => void
}

export function ExpenseFields({ items, onAdd, onUpdate, onRemove }: ExpenseFieldsProps): JSX.Element {
  return (
    <div class="repeat-list">
      {items.map((item) => (
        <div class="repeat-item" key={item.id}>
          <div class="repeat-item-header">
            <TextField
              label="What is it?"
              value={item.label}
              placeholder="e.g. Mortgage, health insurance premiums, childcare"
              onChange={(label) => onUpdate(item.id, { label })}
            />
            <RemoveButton onClick={() => onRemove(item.id)} />
          </div>
          <div class="field-grid">
            <NumberField label="Annual amount" value={item.annual} step={500} prefix="$"
              onChange={(n) => onUpdate(item.id, { annual: n })} />
            <NumberField label="Starts at age" value={item.startAge} min={18} max={105}
              onChange={(n) => onUpdate(item.id, { startAge: n })} />
          </div>
          <Checkbox
            label="Ends at a specific age"
            checked={item.hasEndAge}
            onChange={(hasEndAge) => onUpdate(item.id, { hasEndAge })}
          />
          {item.hasEndAge && (
            <NumberField label="Ends at age" value={item.endAge} min={item.startAge} max={105}
              onChange={(n) => onUpdate(item.id, { endAge: n })} />
          )}
          <Checkbox
            label="Keeps pace with inflation"
            checked={item.inflationAdjusted}
            onChange={(inflationAdjusted) => onUpdate(item.id, { inflationAdjusted })}
          />
        </div>
      ))}
      <button type="button" class="repeat-add" onClick={onAdd}>
        + Add expense
      </button>
    </div>
  )
}

const ACCOUNT_OPTIONS: { value: AccountKind; label: string }[] = [
  { value: 'taxable', label: 'Brokerage/savings' },
  { value: 'pretax', label: '401(k)/IRA' },
  { value: 'roth', label: 'Roth' },
  { value: 'hsa', label: 'HSA' },
]

interface LumpSumFieldsProps {
  items: LumpSumItemState[]
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<LumpSumItemState>) => void
  onRemove: (id: string) => void
}

export function LumpSumFields({ items, onAdd, onUpdate, onRemove }: LumpSumFieldsProps): JSX.Element {
  return (
    <div class="repeat-list">
      {items.map((item) => (
        <div class="repeat-item" key={item.id}>
          <div class="repeat-item-header">
            <TextField
              label="What is it?"
              value={item.label}
              placeholder="e.g. Inheritance, home sale, business sale"
              onChange={(label) => onUpdate(item.id, { label })}
            />
            <RemoveButton onClick={() => onRemove(item.id)} />
          </div>
          <div class="field-grid">
            <NumberField label="Amount" value={item.amount} step={1000} prefix="$"
              onChange={(n) => onUpdate(item.id, { amount: n })} />
            <NumberField label="At age" value={item.atAge} min={18} max={105}
              onChange={(n) => onUpdate(item.id, { atAge: n })} />
            <SelectField
              label="Goes into"
              value={item.into}
              options={ACCOUNT_OPTIONS}
              onChange={(into) => onUpdate(item.id, { into })}
            />
          </div>
          <Checkbox
            label="Taxable when received"
            checked={item.taxable}
            onChange={(taxable) => onUpdate(item.id, { taxable })}
          />
        </div>
      ))}
      <button type="button" class="repeat-add" onClick={onAdd}>
        + Add one-time amount
      </button>
    </div>
  )
}
