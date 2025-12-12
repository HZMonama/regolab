import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  deleteDoc, 
  query, 
  orderBy,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Policy document interface
export interface PolicyDocument {
  id: string;
  name: string;
  policy: string;
  input: string;
  data: string;
  test: string;
  createdAt: unknown; // Firestore Timestamp
  updatedAt: unknown; // Firestore Timestamp
}

// Default welcome policy for unauthenticated users
export const WELCOME_POLICY: Omit<PolicyDocument, 'id' | 'name' | 'createdAt' | 'updatedAt'> = {
  policy: `# Welcome to RegoLab Cloud
# -------------------------
# You are currently in "Scratchpad" mode.
# Sign in with GitHub to save your policies to the cloud.
#
# Try editing this policy and clicking "Evaluate"!

package play

default hello := false

hello if {
    input.message == "world"
}

# Try changing the input to: {"message": "world"}
`,
  input: '{\n  "message": "hello"\n}',
  data: '{}',
  test: `package play

test_hello_is_false_by_default if {
    not hello with input as {"message": "not world"}
}

test_hello_is_true_when_message_is_world if {
    hello with input as {"message": "world"}
}
`
};

// Get the policies collection reference for a user
function getUserPoliciesRef(userId: string) {
  return collection(db, "users", userId, "policies");
}

// Get a single policy document reference
function getPolicyDocRef(userId: string, policyId: string) {
  return doc(db, "users", userId, "policies", policyId);
}

// Subscribe to real-time policy list updates
export function subscribeToPolicies(
  userId: string,
  onPolicies: (policies: PolicyDocument[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    getUserPoliciesRef(userId),
    orderBy("updatedAt", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const policies = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PolicyDocument[];
      onPolicies(policies);
    },
    (error) => {
      console.error("Firestore subscription error:", error);
      onError?.(error);
    }
  );
}

// Get all policies for a user
export async function getPolicies(userId: string): Promise<PolicyDocument[]> {
  const q = query(
    getUserPoliciesRef(userId),
    orderBy("updatedAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PolicyDocument[];
}

// Get a single policy
export async function getPolicy(userId: string, policyId: string): Promise<PolicyDocument | null> {
  const docRef = getPolicyDocRef(userId, policyId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as PolicyDocument;
}

// Create or update a policy
export async function savePolicy(
  userId: string,
  policyId: string,
  data: {
    policy: string;
    input: string;
    data: string;
    test: string;
    name?: string;
  }
): Promise<void> {
  const docRef = getPolicyDocRef(userId, policyId);
  const existing = await getDoc(docRef);
  
  if (existing.exists()) {
    // Update existing document
    await setDoc(docRef, {
      ...data,
      name: data.name || policyId,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } else {
    // Create new document
    await setDoc(docRef, {
      id: policyId,
      name: data.name || policyId,
      policy: data.policy,
      input: data.input,
      data: data.data,
      test: data.test,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

// Delete a policy
export async function deletePolicy(userId: string, policyId: string): Promise<void> {
  const docRef = getPolicyDocRef(userId, policyId);
  await deleteDoc(docRef);
}

// Rename a policy (delete old, create new with same content)
export async function renamePolicy(
  userId: string, 
  oldId: string, 
  newId: string
): Promise<void> {
  const oldDoc = await getPolicy(userId, oldId);
  if (!oldDoc) {
    throw new Error(`Policy ${oldId} not found`);
  }
  
  // Create new document with new ID
  await savePolicy(userId, newId, {
    policy: oldDoc.policy,
    input: oldDoc.input,
    data: oldDoc.data,
    test: oldDoc.test,
    name: newId,
  });
  
  // Delete old document
  await deletePolicy(userId, oldId);
}

// Generate next available policy ID
export function generatePolicyId(existingPolicies: string[]): string {
  const numbers = existingPolicies
    .map((p) => {
      const match = p.match(/^policy-(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    })
    .filter((n) => !isNaN(n));

  const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `policy-${nextNum}`;
}
