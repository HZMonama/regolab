'use client';

import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  type DocumentData,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { getPolicy as firestoreGetPolicy } from "@/lib/firestore-service";

export type ShareExpirationPreset =
  | "1h"
  | "1d"
  | "7d"
  | "30d"
  | "never";

export interface SharedFilesSnapshot {
  policy: string;
  input: string;
  data: string;
  test: string;
}

export interface ShareDocument extends DocumentData {
  name: string;
  files: SharedFilesSnapshot;
  createdAt: unknown;
  createdBy: string;
  expiresAt: Timestamp | null;
  schemaVersion: 1;
}

function addPresetToDate(now: Date, preset: ShareExpirationPreset): Date | null {
  const ms =
    preset === "1h"
      ? 60 * 60 * 1000
      : preset === "1d"
        ? 24 * 60 * 60 * 1000
        : preset === "7d"
          ? 7 * 24 * 60 * 60 * 1000
          : preset === "30d"
            ? 30 * 24 * 60 * 60 * 1000
            : null;

  if (ms === null) return null;
  return new Date(now.getTime() + ms);
}

function makeShareUrl(shareId: string): string {
  // Works client-side (we're a client module).
  return `${window.location.origin}/share/${encodeURIComponent(shareId)}`;
}

export async function createShareForPolicy(options: {
  userId: string;
  policyId: string;
  expiration: ShareExpirationPreset;
}): Promise<{ shareId: string; url: string; expiresAt: Date | null }> {
  const { userId, policyId, expiration } = options;

  const policyDoc = await firestoreGetPolicy(userId, policyId);
  if (!policyDoc) throw new Error("Policy not found");

  const sharesRef = collection(db, "shares");
  const shareRef = doc(sharesRef);

  const now = new Date();
  const expiresAtDate = addPresetToDate(now, expiration);

  const shareDoc: ShareDocument = {
    schemaVersion: 1,
    name: policyId,
    files: {
      policy: policyDoc.policy,
      input: policyDoc.input,
      data: policyDoc.data,
      test: policyDoc.test,
    },
    createdAt: serverTimestamp(),
    createdBy: userId,
    expiresAt: expiresAtDate ? Timestamp.fromDate(expiresAtDate) : null,
  };

  await setDoc(shareRef, shareDoc);

  return {
    shareId: shareRef.id,
    url: makeShareUrl(shareRef.id),
    expiresAt: expiresAtDate,
  };
}

export async function getShare(shareId: string): Promise<{
  id: string;
  name: string;
  files: SharedFilesSnapshot;
  expiresAt: Date | null;
}> {
  const shareRef = doc(db, "shares", shareId);
  const snap = await getDoc(shareRef);
  if (!snap.exists()) throw new Error("Share not found");

  const data = snap.data() as ShareDocument;

  const expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : null;
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    throw new Error("Share expired");
  }

  return {
    id: snap.id,
    name: data.name,
    files: data.files,
    expiresAt,
  };
}
