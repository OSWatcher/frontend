import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  from,
  split,
  type TypePolicies
} from '@apollo/client/core'
import { onError } from '@apollo/client/link/error'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { createClient } from 'graphql-ws'
import { getMainDefinition } from '@apollo/client/utilities'

// Define the API URL through an environment variable
const apiUri = import.meta.env.VITE_OSWATCHER_API_URI
if (!apiUri) {
  throw new Error('VITE_OSWATCHER_API_URI environment variable is required')
}

// HTTP Link for queries and mutations
const httpLink = new HttpLink({
  uri: new URL('graphql', apiUri).toString()
})

// WebSocket Link for subscriptions
const wsUri = apiUri.replace(/^http/, 'ws')
const wsLink = new GraphQLWsLink(
  createClient({
    url: new URL('graphql', wsUri).toString()
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
  link: from([errorLink, splitLink]), // Link chain: error handling, then split link
  cache: new InMemoryCache({ typePolicies }),
  connectToDevTools: import.meta.env.DEV, // Enable Apollo DevTools in development mode
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network'
    }
  }
})

export default gqlClient
