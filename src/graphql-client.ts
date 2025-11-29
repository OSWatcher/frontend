import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  from,
  split,
  type TypePolicies
} from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { createClient } from 'graphql-ws'
import { getMainDefinition } from '@apollo/client/utilities'

// Define the API URL through an environment variable
const apiUri = import.meta.env.VITE_GRAPHEOS_API_URI
if (!apiUri) {
  throw new Error('VITE_GRAPHEOS_API_URI environment variable is required')
}

// Global token getter - will be set by App.vue
let getAccessTokenSilently: (() => Promise<string>) | null = null

export function setAuthTokenGetter(getter: () => Promise<string>) {
  getAccessTokenSilently = getter
}

// Auth Link: adds Bearer token to requests if user is authenticated
const authLink = setContext(async (_, { headers }) => {
  try {
    // If no token getter is set up yet, or user not authenticated, proceed without token
    if (!getAccessTokenSilently) {
      return { headers }
    }

    const token = await getAccessTokenSilently()

    return {
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : ''
      }
    }
  } catch (error) {
    // If token retrieval fails (e.g., user not authenticated), proceed without token
    console.debug('No auth token available:', error)
    return { headers }
  }
})

// HTTP Link for queries and mutations
const httpLink = new HttpLink({
  uri: new URL('graphql', apiUri).toString()
})

// WebSocket Link for subscriptions
const wsUri = apiUri.replace(/^http/, 'ws')
const wsLink = new GraphQLWsLink(
  createClient({
    url: new URL('graphql', wsUri).toString(),
    connectionParams: async () => {
      try {
        if (!getAccessTokenSilently) {
          return {}
        }

        const token = await getAccessTokenSilently()
        return {
          authorization: token ? `Bearer ${token}` : ''
        }
      } catch (error) {
        console.debug('No auth token available for WebSocket:', error)
        return {}
      }
    }
  })
)

// Optional: Error handling link
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors)
    graphQLErrors.forEach(({ message, locations, path }) =>
      console.log(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`)
    )
  if (networkError) console.log(`[Network error]: ${networkError}. Backend is unreachable.`)
})

// Define type policies
const typePolicies: TypePolicies = {
  // Add your type policies here, for example:
  // Query: {
  //   fields: {
  //     someField: {
  //       merge(existing, incoming) {
  //         // Custom merge function
  //       }
  //     }
  //   }
  // }
}

// Split link: use WebSocket for subscriptions, HTTP for queries/mutations
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query)
    return definition.kind === 'OperationDefinition' && definition.operation === 'subscription'
  },
  wsLink,
  httpLink
)

// Apollo Client instance
const gqlClient = new ApolloClient({
  link: from([errorLink, authLink, splitLink]), // Link chain: error handling, auth, then split link
  cache: new InMemoryCache({ typePolicies }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network'
    }
  }
})

export default gqlClient
