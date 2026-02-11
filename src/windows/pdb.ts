/**
 * PDB / Debug Info Resolution Utilities
 *
 * Functions to discover blobs with symbols/structs and resolve
 * their blob hashes for symbol/struct exploration.
 * Supports any OS (Windows PDB, Linux DWARF, etc.)
 */

import gqlClient from '@/graphql-client'
import { TRAVERSE_PATH, GET_BLOBS_WITH_SYMBOLS } from '@/queries'
import { fetchFsRootHash } from '@/utils'
import type { SymbolBlob, PDBContext, PDBContextDiff } from '@/types/pdb'

/**
 * Fetch all blobs that have symbols or structs for a given commit
 * @param commitHash - Commit hash to query
 * @returns Array of SymbolBlob objects
 */
export async function fetchBlobsWithSymbols(commitHash: string): Promise<SymbolBlob[]> {
  try {
    const response = await gqlClient.query({
      query: GET_BLOBS_WITH_SYMBOLS,
      variables: { commitHash }
    })

    const blobs = response.data?.getBlobsWithSymbols || []
    return blobs.map((b: { blob_hash: string; blob_path: string }) => ({
      blobHash: b.blob_hash,
      blobPath: b.blob_path,
      displayName: b.blob_path.split('/').pop() || b.blob_path
    }))
  } catch (err) {
    console.error('Error fetching blobs with symbols:', err)
    return []
  }
}

/**
 * Build a PDBContext from a selected SymbolBlob
 */
export function buildPDBContext(blob: SymbolBlob): PDBContext {
  return {
    blobHash: blob.blobHash,
    blobName: blob.displayName,
    blobPath: blob.blobPath
  }
}

/**
 * Build a PDBContextDiff by resolving the same blob path in the diffee commit
 * @param blob - The selected blob (from the base commit)
 * @param diffeeCommitHash - The diffee commit hash to resolve the same path in
 * @returns PDBContextDiff or null if the blob path doesn't exist in the diffee commit
 */
export async function buildPDBContextDiff(
  blob: SymbolBlob,
  diffeeCommitHash: string
): Promise<PDBContextDiff | null> {
  try {
    const diffeeFsRoot = await fetchFsRootHash(diffeeCommitHash)

    const diffeeResponse = await gqlClient.query({
      query: TRAVERSE_PATH,
      variables: {
        parent_label: 'Tree',
        tree_hash: diffeeFsRoot,
        path: blob.blobPath
      }
    })

    const diffeeBlobHash = diffeeResponse.data?.traversePath
    if (!diffeeBlobHash) {
      console.warn(`Blob path ${blob.blobPath} not found in diffee commit`)
      return null
    }

    return {
      baseBlobHash: blob.blobHash,
      diffeeBlobHash,
      blobName: blob.displayName,
      blobPath: blob.blobPath
    }
  } catch (err) {
    console.error('Error building PDB context diff:', err)
    return null
  }
}
