/**
 * PDB Resolution Utilities
 *
 * Functions to locate ntoskrnl.exe and resolve its blob hash
 * for PDB symbol/struct exploration.
 */

import gqlClient from '@/graphql-client'
import { TRAVERSE_PATH } from '@/queries'
import { fetchFsRootHash } from '@/utils'
import type { PDBContext, PDBContextDiff } from '@/types/pdb'

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

/**
 * Resolve ntoskrnl.exe blob hashes for comparison mode (two commits)
 * @param baseCommitHash - Base commit hash
 * @param diffeeCommitHash - Diffee commit hash
 * @returns PDBContextDiff with both blob hashes, or null if either not found
 */
export async function resolvePDBContextDiff(
  baseCommitHash: string,
  diffeeCommitHash: string
): Promise<PDBContextDiff | null> {
  try {
    const [baseFsRoot, diffeeFsRoot] = await Promise.all([
      fetchFsRootHash(baseCommitHash),
      fetchFsRootHash(diffeeCommitHash)
    ])

    const [baseResponse, diffeeResponse] = await Promise.all([
      gqlClient.query({
        query: TRAVERSE_PATH,
        variables: {
          parent_label: 'Tree',
          tree_hash: baseFsRoot,
          path: NTOSKRNL_PATH
        }
      }),
      gqlClient.query({
        query: TRAVERSE_PATH,
        variables: {
          parent_label: 'Tree',
          tree_hash: diffeeFsRoot,
          path: NTOSKRNL_PATH
        }
      })
    ])

    const baseBlobHash = baseResponse.data?.traversePath
    const diffeeBlobHash = diffeeResponse.data?.traversePath

    if (!baseBlobHash || !diffeeBlobHash) {
      console.warn('Could not resolve ntoskrnl.exe for one or both commits')
      return null
    }

    return {
      baseBlobHash,
      diffeeBlobHash,
      blobName: 'ntoskrnl.exe'
    }
  } catch (err) {
    console.error('Error resolving PDB context diff:', err)
    return null
  }
}
