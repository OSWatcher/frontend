import type { HashDiff } from './types'
import gqlClient from '@/graphql-client'
import { GetFsRootDocument } from '@/graphql-types'
import type { GetFsRootQuery, GetFsRootQueryVariables } from '@/graphql-types'

export async function fetchFSRootCommitDiff(commitDiff: HashDiff): Promise<HashDiff> {
  // assert label is 'Commit'
  if (commitDiff.label !== 'Commit') {
    throw new Error('Invalid label')
  }
  const [baseHash, diffeeHash] = await Promise.all([
    fetchFsRootHash(commitDiff.base_hash!),
    fetchFsRootHash(commitDiff.diffee_hash!)
  ])
  // check if query succeeded
  if (baseHash && diffeeHash) {
    return {
      base_hash: baseHash,
      diffee_hash: diffeeHash,
      label: 'Tree'
    }
  }
  throw new Error('Failed to fetch filesystem root hash')
}

export async function fetchFsRootHash(commitHash: string): Promise<string> {
  const response = await gqlClient.query<GetFsRootQuery, GetFsRootQueryVariables>({
    query: GetFsRootDocument,
    variables: { where: { hash: commitHash } }
  })
  const fs_hash = response.data?.commits?.[0]?.filesystemConnection?.edges?.[0]?.node?.hash ?? null
  if (fs_hash == null) {
    throw new Error('Failed to fetch filesystem root hash')
  }
  return fs_hash
}
