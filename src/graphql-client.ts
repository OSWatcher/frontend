import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client/core'
import { onError } from '@apollo/client/link/error'
import { TypedTypePolicies } from '@/graphql-types'

// Define the API URL through an environment variable
const httpLink = new HttpLink({
  uri: new URL('graphql', import.meta.env.VITE_GRAPHEOS_API_URI).toString()
})

// Optional: Error handling link
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors)
    graphQLErrors.forEach(({ message, locations, path }) =>
      console.log(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`)
    )
  if (networkError) console.log(`[Network error]: ${networkError}. Backend is unreachable.`)
})

// Define type policies
const typePolicies: TypedTypePolicies = {
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

// Apollo Client instance
const gqlClient = new ApolloClient({
  link: from([errorLink, httpLink]), // Link chain: error handling followed by HTTP connection
  cache: new InMemoryCache({ typePolicies }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network'
    }
  }
})

export default gqlClient
