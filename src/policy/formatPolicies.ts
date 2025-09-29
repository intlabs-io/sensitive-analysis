import { PolicyFragment } from '../types';

/**
 * Fetches and formats policy strings from GraphQL database.
 *
 *  - POLICY: retrieves multiple policies by uuid and formats them.
 *
 * The returned array is suitable for concatenation with `\n` to build the
 * prompt used by the OpenAI agent.
 */
export const formatPolicies = async (
  policies: PolicyFragment[],
): Promise<string[]> => {
  const formattedStrings: string[] = [];

  try {

    // Format the policies
    for (const policyData of policies) {
      if (policyData) {
        let formatted = `${policyData.name} Privacy Policy. Documents: `;

        // Handle documents array - it's stored as jsonb in the database
        const documents =
          (policyData.documents as Array<{ title: string; snippet: string }>) ||
          [];

        formatted += documents
          .map(
            (doc: { title: string; snippet: string }) =>
              `Section: ${doc.title} - Reference: '${doc.snippet}'.`,
          )
          .join(' ');
        formattedStrings.push(formatted);
      }
    }
  } catch (error) {
    console.error('Error fetching policies:', error);
    // Return empty array on error rather than throwing
  }

  return formattedStrings;
};
