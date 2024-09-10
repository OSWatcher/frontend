/*
common function and constants for any component based on Windows Registry
*/
import gqlClient from '@/graphql-client'
import { TRAVERSE_PATH, GET_FS_ROOT, HAS_WINREG } from '@/queries'

const S32_CONFIG = '/Windows/System32/config'
export const HKLM = 'HKEY_LOCAL_MACHINE'
export const HKU = 'HKEY_USERS'

export interface WinRegHive {
  path: string
  mount_path: string
  blob_hash: string | null
  winreg_hash: string | null
}

const SystemHives: WinRegHive[] = [
  { path: `${S32_CONFIG}/SAM`, mount_path: `${HKLM}/SAM`, blob_hash: null, winreg_hash: null },
  {
    path: `${S32_CONFIG}/SECURITY`,
    mount_path: `${HKLM}/SECURITY`,
    blob_hash: null,
    winreg_hash: null
  },
  {
    path: `${S32_CONFIG}/SOFTWARE`,
    mount_path: `${HKLM}/SOFTWARE`,
    blob_hash: null,
    winreg_hash: null
  },
  {
    path: `${S32_CONFIG}/SYSTEM`,
    mount_path: `${HKLM}/SYSTEM`,
    blob_hash: null,
    winreg_hash: null
  },
  {
    path: `${S32_CONFIG}/DEFAULT`,
    mount_path: `${HKU}/.Default`,
    blob_hash: null,
    winreg_hash: null
  }
]

export async function GetSystemHives(os_hash: string): Promise<WinRegHive[]> {
  try {
    // fetch FS root
    const response = await gqlClient.query({
      query: GET_FS_ROOT,
      variables: { where: { hash: os_hash } }
    })
    const tree_hash =
      response.data?.commits?.[0]?.filesystemConnection?.edges?.[0]?.node?.hash ?? null
    if (tree_hash === null) {
      console.error('Failed to retrieve filesystem root hash from the response')
      throw new Error('Invalid response structure')
    }
    const fs_root = tree_hash

    // make a copy of SystemHives
    // and fetch blob hash for each hive
    const CopyOfSystemHives = SystemHives.map((hive) => ({ ...hive }))
    await Promise.all(
      CopyOfSystemHives.map(async (hive) => {
        const response = await gqlClient.query({
          query: TRAVERSE_PATH,
          variables: { parent_label: 'Tree', tree_hash: fs_root, path: hive.path }
        })
        hive.blob_hash = response.data['traversePath']
      })
    )

    // fetch winreg hash for each hive
    await Promise.all(
      CopyOfSystemHives.map(async (hive) => {
        const response = await gqlClient.query({
          query: HAS_WINREG,
          variables: { where: { hash: hive.blob_hash } }
        })
        hive.winreg_hash = response.data.blobs[0].has_winreg.hash
      })
    )
    return CopyOfSystemHives
  } catch (error) {
    throw error
  }
}
