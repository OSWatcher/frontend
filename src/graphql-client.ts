import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client/core';
import { onError } from '@apollo/client/link/error';


// Define the API URL through an environment variable
const httpLink = new HttpLink({
    uri: import.meta.env.VITE_GRAPHEOS_API_URI
});

// Optional: Error handling link
const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (graphQLErrors)
        graphQLErrors.forEach(({ message, locations, path }) =>
            console.log(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`)
        );
    if (networkError) console.log(`[Network error]: ${networkError}. Backend is unreachable.`);
});

// Apollo Client instance
const gqlClient = new ApolloClient({
    link: from([errorLink, httpLink]), // Link chain: error handling followed by HTTP connection
    cache: new InMemoryCache()
});

export default gqlClient;