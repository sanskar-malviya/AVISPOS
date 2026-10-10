import { useEffect, useState, type FormEvent } from 'react';
import { useShopData } from '../../app/data';
import { useToast } from '../../components/Toast';
import { ReceiptPreview } from '../../components/ReceiptPreview';
import { saveSettings } from '../../data/settings';
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
>;

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
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 w-5 h-5 accent-tandoori-700"
            checked={draft.receiptLogo}
            onChange={(e) => set('receiptLogo', e.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold text-stone-700">Logo on receipts</span>
            <span className="block text-xs text-stone-500">
              Printed at the top of every receipt. Browser prints also get a faint logo behind the
              items. Adds about a second to Bluetooth printing.
            </span>
          </span>
        </label>
        {field('vegLabel', 'Veg badge text', { max: 12 })}

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
