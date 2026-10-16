import { useEffect, useState, type FormEvent } from 'react';
import { useShopData } from '../../app/data';
import { useToast } from '../../components/Toast';
import { ReceiptPreview } from '../../components/ReceiptPreview';
import { MAX_DAY_START_HOUR, saveSettings } from '../../data/settings';
import { sampleOrder } from '../../lib/sampleOrder';
import type { BusinessSettings, PaperWidth } from '../../lib/types';

type Draft = Pick<
  BusinessSettings,
  | 'businessName'
  | 'tagline'
  | 'contact'
  | 'receiptHeader'
  | 'receiptFooter'
  | 'paperWidth'
  | 'vegLabel'
  | 'receiptLogo'
  | 'receiptWatermark'
  | 'tokenSlip'
  | 'tokenItems'
  | 'dayStartHour'
>;

const hourLabel = (h: number) => (h === 0 ? '12:00 am (midnight)' : `${h}:00 am`);

function pick(s: BusinessSettings): Draft {
  return {
    businessName: s.businessName,
    tagline: s.tagline,
    contact: s.contact,
    receiptHeader: s.receiptHeader,
    receiptFooter: s.receiptFooter,
    paperWidth: s.paperWidth,
    vegLabel: s.vegLabel,
    receiptLogo: s.receiptLogo,
    receiptWatermark: s.receiptWatermark,
    tokenSlip: s.tokenSlip,
    tokenItems: s.tokenItems,
    dayStartHour: s.dayStartHour,
  };
}

export function BusinessTab() {
  const { settings } = useShopData();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => pick(settings));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pick up changes saved elsewhere, unless the owner is mid-edit.
  useEffect(() => {
    if (!dirty) setDraft(pick(settings));
  }, [settings, dirty]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft.businessName.trim()) {
      toast.error('Business name is required.');
      return;
    }
    setSaving(true);
    try {
      await saveSettings({
        ...draft,
        businessName: draft.businessName.trim(),
        tagline: draft.tagline.trim(),
        contact: draft.contact.trim(),
        vegLabel: draft.vegLabel.trim() || 'VEG',
      });
      setDirty(false);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(`Could not save: ${err instanceof Error ? err.message : err}`);
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof Draft, label: string, opts: { max?: number; hint?: string } = {}) => (
    <div>
      <label className="block text-sm font-semibold text-stone-700 mb-1">{label}</label>
      <input
        className="input w-full"
        value={draft[key] as string}
        maxLength={opts.max ?? 60}
        onChange={(e) => set(key, e.target.value as never)}
      />
      {opts.hint && <p className="text-xs text-stone-500 mt-1">{opts.hint}</p>}
    </div>
  );

  return (
    <div className="grid xl:grid-cols-[1fr,auto] gap-6 items-start max-w-5xl">
      <form onSubmit={save} className="card p-5 space-y-4">
        <h1 className="text-xl font-extrabold">Business &amp; receipt</h1>
        {field('businessName', 'Business name', { max: 40 })}
        {field('tagline', 'Tagline', { hint: 'Printed under the name, e.g. “100% Vegetarian”.' })}
        {field('contact', 'Contact (optional)', {
          max: 80,
          hint: 'e.g. phone number or address line.',
        })}
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">
            Receipt heading (optional)
          </label>
          <textarea
            className="input w-full"
            rows={2}
            maxLength={160}
            value={draft.receiptHeader}
            onChange={(e) => set('receiptHeader', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">Receipt footer</label>
          <textarea
            className="input w-full"
            rows={2}
            maxLength={160}
            value={draft.receiptFooter}
            onChange={(e) => set('receiptFooter', e.target.value)}
          />
        </div>
        <div>
          <span className="block text-sm font-semibold text-stone-700 mb-1">Receipt paper width</span>
          <div className="flex gap-2">
            {(['58', '80'] as PaperWidth[]).map((w) => (
              <button
                type="button"
                key={w}
                onClick={() => set('paperWidth', w)}
                className={
                  'btn flex-1 border-2 ' +
                  (draft.paperWidth === w
                    ? 'border-tandoori-700 bg-tandoori-700 text-white'
                    : 'border-stone-200 bg-white')
                }
              >
                {w} mm
              </button>
            ))}
          </div>
        </div>
<fieldset className="space-y-3">
          <legend className="block text-sm font-semibold text-stone-700 mb-1">When printing</legend>
          {(
            [
              [
                'receiptLogo',
                'Logo at the top',
                'The shop logo above the receipt. Adds about a second to Bluetooth printing.',
              ],
              [
                'receiptWatermark',
                'Logo watermark',
                'A faint logo behind the items. On the Bluetooth printer those lines print as a picture, which adds a few seconds.',
              ],
              [
                'tokenSlip',
                'Separate token slip',
                'After the receipt, a small slip with the token number in big type for calling out orders.',
              ],
              [
                'tokenItems',
                'Food & quantity on the token slip',
                'Lists what to prepare (e.g. "2 x Extra Bhatura") under the token number.',
              ],
            ] as const
          ).map(([key, title, help]) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 w-5 h-5 accent-tandoori-700"
                checked={draft[key]}
                onChange={(e) => set(key, e.target.checked)}
              />
              <span>
                <span className="block text-sm font-semibold text-stone-700">{title}</span>
                <span className="block text-xs text-stone-500">{help}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {field('vegLabel', 'Veg badge text', { max: 12 })}

        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">
            Business day starts at
          </label>
          <select
            className="input w-full"
            value={draft.dayStartHour}
            onChange={(e) => set('dayStartHour', Number(e.target.value))}
          >
            {Array.from({ length: MAX_DAY_START_HOUR + 1 }, (_, h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
          <p className="text-xs text-stone-500 mt-1">
            Sales made after midnight but before this time count as the previous day: same day's
            order numbers and tokens, and they appear in that day's report. Applies to new sales
            from now on; earlier sales keep their day.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button className="btn-primary" disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {dirty && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setDraft(pick(settings));
                setDirty(false);
              }}
            >
              Discard
            </button>
          )}
        </div>
      </form>

      <div>
        <p className="text-sm font-semibold text-stone-500 mb-2">Receipt preview</p>
        <ReceiptPreview order={sampleOrder()} settings={{ ...settings, ...draft }} />
      </div>
    </div>
  );
}
