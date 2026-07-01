import { atom } from 'jotai';
import type { Table, Relationship } from '../types';

export const selectedTableIdAtom = atom<string | null>(null);
export const editingTableAtom = atom<Table | null>(null);
export const mappingRelationshipAtom = atom<Relationship | null>(null);
export const addTableCallbackAtom = atom<((name: string) => void) | null>(null);
export const editingNodeIdAtom = atom<string | null>(null);
