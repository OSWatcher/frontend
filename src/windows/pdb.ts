/**
 * PDB Resolution Utilities
 *
 * Functions to locate ntoskrnl.exe and resolve its blob hash
 * for PDB symbol/struct exploration.
 */

import gqlClient from '@/graphql-client'
import { TRAVERSE_PATH } from '@/queries'
import { fetchFsRootHash } from '@/utils'
import type { PDBContext } from '@/types/pdb'

const NTOSKRNL_PATH = '/Windows/System32/ntoskrnl.exe'

/**
 * Resolve ntoskrnl.exe blob hash for a single commit
 * @param commitHash - Commit hash to resolve PDB data for
 * @returns PDBContext with blob hash and name, or null if not found
 */
export async function resolvePDBContext(commitHash: string): Promise<PDBContext | null> {
  try {
    const fsRoot = await fetchFsRootHash(commitHash)

    const response = await gqlClient.query({
      query: TRAVERSE_PATH,
      variables: {
        parent_label: 'Tree',
        tree_hash: fsRoot,
        path: NTOSKRNL_PATH
      }
    })

    const blobHash = response.data?.traversePath
    if (!blobHash) {
      return null
    }

    return {
      blobHash,
      blobName: 'ntoskrnl.exe'
    }
  } catch (err) {
    console.error('Error resolving PDB context:', err)
    return null
  }
}
