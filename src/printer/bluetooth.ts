// Web Bluetooth (BLE) driver for ESC/POS thermal printers — silent printing on
// Chrome for Android (spec §6). Requires HTTPS (or localhost).
//
// Web Bluetooth types are not in TypeScript's DOM lib, so the small subset used
// here is declared locally (kept module-scoped to avoid global clashes).

interface BtCharacteristic {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
}
interface BtService {
  getCharacteristics(): Promise<BtCharacteristic[]>;
}
interface BtServer {
  connected: boolean;
  connect(): Promise<BtServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<BtService[]>;
}
interface BtDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BtServer;
}
interface BtApi {
  requestDevice(options: {
    acceptAllDevices?: boolean;
    filters?: { services: string[] }[];
    optionalServices?: string[];
  }): Promise<BtDevice>;
  getDevices?: () => Promise<BtDevice[]>;
}

function bt(): BtApi | undefined {
  return (navigator as unknown as { bluetooth?: BtApi }).bluetooth;
}

/**
 * GATT services exposed by common BLE thermal printers (generic Chinese 58 mm
 * units, Xprinter, Rongta, GOOJPRT, MTP, Milestone, etc.). Web Bluetooth only
 * lets us talk to services listed here.
 */
const KNOWN_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
];

const CHUNK = 100; // bytes per BLE write — safe for the default MTU
const CONNECT_TIMEOUT_MS = 10000;
const LAST_DEVICE_KEY = 'aviz.printer.lastDevice';

export type PrinterStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected' | 'printing';

let device: BtDevice | null = null;
let characteristic: BtCharacteristic | null = null;
let status: PrinterStatus = 'disconnected';
/** Set when the user taps Disconnect, so the app doesn't silently reconnect right away. */
let manuallyDisconnected = false;
const listeners = new Set<(s: PrinterStatus) => void>();

function setStatus(s: PrinterStatus) {
  status = s;
  listeners.forEach((l) => l(s));
}

export function isBluetoothSupported(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && !!bt();
}

export function getPrinterStatus(): PrinterStatus {
  return isBluetoothSupported() ? status : 'unsupported';
}

export function onPrinterStatus(cb: (s: PrinterStatus) => void): () => void {
  listeners.add(cb);
  cb(getPrinterStatus());
  return () => {
    listeners.delete(cb);
  };
}

export function connectedPrinterName(): string {
  return device?.gatt?.connected ? device.name || 'Bluetooth printer' : '';
}

export class PrinterError extends Error {}
/** The picker was closed without choosing a device (cancelled, or nothing listed). */
export class NoPrinterSelectedError extends PrinterError {}

const UNSUPPORTED =
  'Bluetooth printing is not supported in this browser. Use Google Chrome on the Android tablet (over https).';

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new PrinterError(msg)), ms)),
  ]);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function onDisconnected() {
  characteristic = null;
  setStatus('disconnected');
}

async function findWritable(server: BtServer): Promise<BtCharacteristic | null> {
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const chars = await service.getCharacteristics();
    const ch = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse);
    if (ch) return ch;
  }
  return null;
}

async function attach(dev: BtDevice): Promise<void> {
  if (!dev.gatt) throw new PrinterError('This device does not support Bluetooth LE printing.');
  setStatus('connecting');
  try {
    const server = await withTimeout(
      dev.gatt.connect(),
      CONNECT_TIMEOUT_MS,
      'Could not reach the printer. Check that it is switched on, charged and nearby.',
    );
    const ch = await findWritable(server);
    if (!ch) {
      server.disconnect();
      throw new PrinterError(
        'Connected, but this device has no printing channel. Is it a Bluetooth (BLE) thermal printer?',
      );
    }
    dev.removeEventListener('gattserverdisconnected', onDisconnected);
    dev.addEventListener('gattserverdisconnected', onDisconnected);
    device = dev;
    characteristic = ch;
    try {
      localStorage.setItem(LAST_DEVICE_KEY, JSON.stringify({ id: dev.id, name: dev.name ?? '' }));
    } catch {
      /* ignore */
    }
    setStatus('connected');
  } catch (e) {
    setStatus('disconnected');
    throw e;
  }
}

/**
 * Show the browser's Bluetooth picker and connect. MUST be called directly from
 * a user tap (browser security rule). Returns the printer's name.
 *
 * By default the list is limited to devices that advertise a known printer
 * service, so the cashier isn't scrolling past phones, watches and TVs. Some
 * printers don't advertise their service until connected; `allDevices: true`
 * shows everything nearby for those.
 */
export async function connectBluetoothPrinter(opts: { allDevices?: boolean } = {}): Promise<string> {
  const api = bt();
  if (!api || !window.isSecureContext) throw new PrinterError(UNSUPPORTED);
  manuallyDisconnected = false;
  let dev: BtDevice;
  try {
    dev = await api.requestDevice(
      opts.allDevices
        ? { acceptAllDevices: true, optionalServices: KNOWN_SERVICES }
        : { filters: KNOWN_SERVICES.map((s) => ({ services: [s] })), optionalServices: KNOWN_SERVICES },
    );
  } catch (e) {
    if ((e as Error).name === 'NotFoundError')
      throw new NoPrinterSelectedError('No printer was selected.');
    throw e;
  }
  await attach(dev);
  return dev.name || 'Bluetooth printer';
}

export function disconnectBluetoothPrinter(): void {
  manuallyDisconnected = true;
  device?.gatt?.disconnect();
  device = null;
  characteristic = null;
  setStatus('disconnected');
}

let reconnecting: Promise<boolean> | null = null;

/**
 * Silently reconnect the printer used last time — no picker, no tap needed.
 * Works when Chrome remembered the permission (navigator.bluetooth.getDevices)
 * and the printer is on and in range. Resolves true when connected; never
 * throws. Safe to call repeatedly: concurrent calls share one attempt.
 */
export function reconnectSavedPrinter(): Promise<boolean> {
  if (reconnecting) return reconnecting;
  reconnecting = (async () => {
    try {
      if (!isBluetoothSupported() || manuallyDisconnected) return false;
      if (device?.gatt?.connected && characteristic) return true;
      await ensureConnected();
      return true;
    } catch {
      return false;
    } finally {
      reconnecting = null;
    }
  })();
  return reconnecting;
}

/**
 * Get a writable connection WITHOUT a user gesture: reuse the live connection,
 * reconnect the known device, or (after a page reload) reconnect a printer the
 * user already granted permission to, via navigator.bluetooth.getDevices().
 */
async function ensureConnected(): Promise<BtCharacteristic> {
  if (!isBluetoothSupported()) throw new PrinterError(UNSUPPORTED);
  if (device?.gatt?.connected && characteristic) return characteristic;
  if (device) {
    await attach(device);
    return characteristic!;
  }
  const api = bt()!;
  if (api.getDevices) {
    let saved: { id: string } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(LAST_DEVICE_KEY) || 'null');
    } catch {
      /* ignore */
    }
    const devices = await api.getDevices();
    const match =
      devices.find((d) => saved && d.id === saved.id) ?? (devices.length === 1 ? devices[0] : undefined);
    if (match) {
      await attach(match);
      return characteristic!;
    }
  }
  throw new PrinterError('Printer not connected. Tap the printer button in the top bar to connect it.');
}

/** Name of the printer connected last time (for the top-bar hint), '' if none. */
export function savedPrinterName(): string {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_DEVICE_KEY) || 'null') as { name?: string } | null;
    return saved?.name ?? '';
  } catch {
    return '';
  }
}

/**
 * Send raw ESC/POS bytes. Resolves only after every chunk has been written
 * (acknowledged by the printer when it supports write-with-response). This
 * confirms the data was TRANSMITTED; no web API can confirm paper came out.
 */
export async function bluetoothPrint(data: Uint8Array): Promise<void> {
  const ch = await ensureConnected();
  setStatus('printing');
  try {
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk = data.slice(i, i + CHUNK);
      if (ch.properties.write) {
        await ch.writeValueWithResponse(chunk);
      } else {
        await ch.writeValueWithoutResponse(chunk);
        await sleep(30); // give the printer's buffer time to drain
      }
    }
  } catch (e) {
    throw new PrinterError(
      'Lost connection to the printer while printing. Check the printer and tap Retry.' +
        (e instanceof Error && e.message ? ` (${e.message})` : ''),
    );
  } finally {
    setStatus(device?.gatt?.connected ? 'connected' : 'disconnected');
  }
}
