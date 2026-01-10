// Complete Firebase SDK mock for testing
// This module provides mock implementations that bypass Firebase validation

export class MockCollectionReference {
  constructor(public path: string) {}
}

export class MockDocumentReference {
  constructor(public path: string) {}
}

export class MockQuery {
  constructor(public path: string) {}
}

export class MockDocumentSnapshot {
  constructor(private _exists: boolean = false, private _data: any = {}) {}
  exists() {
    return this._exists;
  }
  data() {
    return this._data;
  }
}

export class MockQuerySnapshot {
  docs = [];
}

export function mockGetFirestore() {
  return {};
}

export function mockCollection(_db: any, path: string) {
  return new MockCollectionReference(path);
}

export function mockDoc(_ref: any, ..._idOrPath: any[]) {
  const id = _idOrPath[0];
  return new MockDocumentReference(`${_ref?.path || ''}/${id || ''}`);
}

export async function mockSetDoc() {
  return undefined;
}

export async function mockGetDoc() {
  return new MockDocumentSnapshot(false, {});
}

export async function mockGetDocs() {
  return new MockQuerySnapshot();
}

export async function mockUpdateDoc() {
  return undefined;
}

export async function mockDeleteDoc() {
  return undefined;
}

export function mockQuery(_ref: any, ..._constraints: any[]) {
  return new MockQuery(_ref?.path || '');
}

export function mockWhere(_field: string, _op: string, _value: any) {
  return {
    _field,
    _op,
    _value,
  };
}

export function mockOnSnapshot(_ref: any, callback: Function) {
  const snapshot = new MockDocumentSnapshot(false, {});
  if (typeof callback === 'function') {
    callback(snapshot);
  }
  return () => {};
}

export const MockTimestamp = {
  now: () => ({ seconds: Date.now() / 1000, nanoseconds: 0 }),
  fromDate: (date: Date) => ({
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  }),
};
