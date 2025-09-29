// Types for the analysis prompts
export interface AnalysisPromptParams {
  policies: string;
  extract: string;
}

// CSV Analysis Prompt
export function createCSVAnalysisPrompt({
  policies,
  extract,
}: AnalysisPromptParams): string {
  return `
Goal
Using the policy provided in REF:policies, analyze the CSV document in REF:extract to identify all entities that qualify as sensitive. 
A sensitive entity is any field that may contain information deemed sensitive according to the policies. The following is examples on what defines sensitive information in REF:policies: Personal Information: Identify fields that contain data such as a person's real name, email address, postal address, or any unique identifier, as defined in Section 1798.140. For example, if a field contains an email like "john.doe@example.com" or a name like "John Doe," it should be flagged as personal information. For each entity that meets this criteria, classify it by indicating which specific keyword(s) or category it corresponds to (eg: personal, financial, health). Finally, provide references from REF:policies that justify each classification.

---

Validation
Alongside the earlier goal instructions, please calculate a confidence rating for each identified field on a scale from 0 to 10, where scores of 0-3 indicate low confidence, 4-7 indicate medium confidence, and 8-10 indicate high confidence. For each identified field, validate your assessment by referencing the specific sections of REF:policies that support your confidence level.

---

Return Object
Create a JSON object with an "entities" key containing an array of objects. Each object in the array should include the following keys:

entity: The header of the identified sensitive entity.
path: The exact header of the column from the CSV (maintain the same casing).
category: The category of the sensitive entity (e.g., personal, financial, health).
reference: Identify the sensitive entity, locate its corresponding justification in REF:policies by extracting the actual policy section (with its identifier) and the exact verbatim excerpt that explains its sensitivity, and output these details in the format: "<policy section header and identifier> - "<exact excerpt from REF:policies>""
Example: "Policy section: # - Snippet: 'This entity contains personal information.'"
confidence: A confidence number score from 1 to 10 for the final answer.
thinking: A short summary of the thinking process.
rankHex: A hex color code representing the severity of the sensitive field:
- Red (#FC1514) = very sensitive
- Yellow (#FFC659) = medium sensitivity
- Green (#A9FF46) = not very sensitive

---

Warnings
1. Pay close attention to the exact column headers in the CSV document. The path field must match the header exactly (including letter casing).
2. Ensure each identified entity is classified correctly according to REF:policies.
3. Provide the word-for-word excerpt from REF:policies that justifies each classification.
4. Use the proper rankHex values for each entity.
5. Include only one path value per identified sensitive entity.

---

Context
REF:policies
${policies}

REF:extract
${extract}
  `.trim();
}

// JSON Analysis Prompt
export function createJSONAnalysisPrompt({
  policies,
  extract,
}: AnalysisPromptParams): string {
  return `
Goal
Using the policy provided in REF:policies, analyze the JSON document in REF:extract to identify all entities that qualify as sensitive. A sensitive entity is any field that may contain information deemed sensitive according to the policies. The following is examples on what defines sensitive information in REF:policies: Personal Information: Identify fields that contain data such as a person's real name, email address, postal address, or any unique identifier, as defined in Section 1798.140. For example, if a field contains an email like "john.doe@example.com" or a name like "John Doe," it should be flagged as personal information. For each entity that meets this criteria, classify it by indicating which specific keyword(s) or category it corresponds to (eg: personal, financial, health). Finally, provide references from REF:policies that justify each classification.

---

Validation
Alongside the earlier goal instructions, please calculate a confidence rating for each identified field on a scale from 0 to 10, where scores of 0-3 indicate low confidence, 4-7 indicate medium confidence, and 8-10 indicate high confidence. For each identified field, validate your assessment by referencing the specific sections of REF:policies that support your confidence level.

---

Return Object
Create a JSON object with an "entities" key containing an array of objects. Each object in the array should include the following keys:

path: The path to get to the identified entity. Please use this specific json path format: if the path is an element of an array then put the path to the array and then [*]. to express the arrays index, the path should look like: 'pathToArray[*].field', if the path is a part of an object put the object path and then the field: 'objectPath.field', and If the path is stand alone then it's just 'field' (make sure you get the casing of the letters correct). It is very important that there is only one path per response.
Examples: 'FirstName', 'object.key', 'array[*].element'.
entity: The simple path of the identified sensitive entity.
category: The category of the sensitive entity (e.g., personal, financial, health).
reference: Identify the sensitive entity, locate its corresponding justification in REF:policies by extracting the actual policy section (with its identifier) and the exact verbatim excerpt that explains its sensitivity, and output these details in the format: "<policy section header and identifier> - "<exact excerpt from REF:policies>""
Example: "Policy section: # - Snippet: 'This entity contains personal information.'"
confidence: A confidence number score from 1 to 10 for the final answer.
thinking: A short summary of the thinking process.
rankHex: A hex color code representing the severity of the sensitive field:
- Red (#FC1514) = very sensitive
- Yellow (#FFC659) = medium sensitivity
- Green (#A9FF46) = not very sensitive

---

Warnings
1. Pay close attention to the REF:extract and its key value pairs of what the object might be implying. For example "name": "John Doe" implies a persons name, but "name": "Company X" implies a company name.
2. Ensure each identified entity is classified correctly according to REF:policies.
3. Provide the word-for-word excerpt from REF:policies that justifies each classification.
4. Use the proper rankHex values for each entity.
5. Include only one path value per identified sensitive entity.

---

Context
REF:policies
${policies}

REF:extract
${extract}
  `.trim();
}

// Unstructured Analysis Prompt
export function createUnstructuredAnalysisPrompt({
  policies,
  extract,
}: AnalysisPromptParams): string {
  return `
Goal
Using the policy provided in REF:policies, analyze the document in REF:extract to identify all entities that qualify as sensitive. A sensitive entity is any field that may contain information deemed sensitive according to the policies. The following is examples on what defines sensitive information in REF:policies: Personal Information: Identify fields that contain data such as a person's real name, email address, postal address, or any unique identifier, as defined in Section 1798.140. For example, if a field contains an email like "john.doe@example.com" or a name like "John Doe," it should be flagged as personal information. For each entity that meets this criteria, classify it by indicating which specific keyword(s) or category it corresponds to (eg: personal, financial, health). Finally, provide references from REF:policies that justify each classification.

---

Validation
Alongside the earlier goal instructions, please calculate a confidence rating for each identified field on a scale from 0 to 10, where scores of 0-3 indicate low confidence, 4-7 indicate medium confidence, and 8-10 indicate high confidence. For each identified field, validate your assessment by referencing the specific sections of REF:policies that support your confidence level.

---

Return Object
Create a JSON object with an "entities" key containing an array of objects. Each object in the array should include the following keys:

entity: Use the value of the identified entity to classify one of the following 'CREDIT_CARD_NUMBER', 'PERSON', 'PERSON_TYPE', 'PHONE_NUMBER', 'ORGANIZATION', 'ADDRESS', 'URL', 'IP_ADDRESS', 'DATETIME', 'EMAIL', 'QUANTITY'
Examples: 'CREDIT_CARD', 'PERSON', 'PHONE_NUMBER', 'ORGANIZATION'
text: The text that was identified as sensitive.
Examples: 'John Doe', '123-456-7890', 'www.example.com'.
category: The category of the sensitive entity (e.g., personal, financial, health).
reference: Identify the sensitive entity, locate its corresponding justification in REF:policies by extracting the actual policy section (with its identifier) and the exact verbatim excerpt that explains its sensitivity, and output these details in the format: "<policy section header and identifier> - "<exact excerpt from REF:policies>""
Example: "Policy section: # - Snippet: 'This entity contains personal information.'"
confidence: A confidence number score from 1 to 10 for the final answer.
thinking: A short summary of the thinking process.
rankHex: A hex color code representing the severity of the sensitive field:
- Red (#FC1514) = very sensitive
- Yellow (#FFC659) = medium sensitivity
- Green (#A9FF46) = not very sensitive

---

Warnings
1. Ensure each identified entity is classified correctly according to REF:policies.
2. Provide the word-for-word excerpt from REF:policies that justifies each classification.
3. The text field needs to be word for word excerpt from the REF:extract.
4. Use the proper rankHex values for each entity.

---

Context
REF:policies
${policies}

REF:extract
${extract}
  `.trim();
}

// Spreadsheet Analysis Prompt
export function createSpreadsheetAnalysisPrompt({
  policies,
  extract,
}: AnalysisPromptParams): string {
  return `
Goal
Using the policy provided in REF:policies, analyze the CSV spreadsheet document in REF:extract to identify all entities that qualify as sensitive. A sensitive entity is any field that may contain information deemed sensitive according to the policies. The following is examples on what defines sensitive information in REF:policies: Personal Information: Identify fields that contain data such as a person's real name, email address, postal address, or any unique identifier, as defined in Section 1798.140. For example, if a field contains an email like "john.doe@example.com" or a name like "John Doe," it should be flagged as personal information. For each entity that meets this criteria, classify it by indicating which specific keyword(s) or category it corresponds to (eg: personal, financial, health). Finally, provide references from REF:policies that justify each classification.

---

Validation
Alongside the earlier goal instructions, please calculate a confidence rating for each identified field on a scale from 0 to 10, where scores of 0-3 indicate low confidence, 4-7 indicate medium confidence, and 8-10 indicate high confidence. For each identified field, validate your assessment by referencing the specific sections of REF:policies that support your confidence level.

---

Return Object
Create a JSON object with an "entities" key containing an array of objects. Each object in the array should include the following keys:

entity: The specific cell value or header within the spreadsheet that has been identified as sensitive. Note that an entity is not the entire column itself but rather the individual cell content or column header labeled as sensitive.
Examples: 'First name', 'name', 'SIN', 'creditCardNumber'
ranges: Provide a range or multiple ranges of the associated cells for the identified entity. The sensitive information will always appear in multiple cells, so you must always specify a range rather than a single cell. The sensitive data may be located in cells directly adjacent to the entity's cell in the same row (horizontally) or in cells directly below it (vertically). Identify and return the correct range(s) that cover all of the sensitive information. If the sensitive data spans more than one continuous block, include each range as a separate string in the array.
- Header Explanation: The first row, labeled "Row,A,B,C", represents the spreadsheet columns.
- Row Explanation: The first column, labeled "1,2,3,4", represents the spreadsheet rows.
- Cell Explanation: A cell is where a row and a column intersect. For example, cell A1 is the intersection of row 1 and column A.
- Range: A range of cells is defined by a starting cell and an ending cell, written in the format: starting cell (Column+Row) and ending cell (Column+Row) separated by a colon (:). For example, "A1:C5" represents a range that starts at cell A1 and ends at cell C5, including all cells in between.
Example: ['A2:A5', 'B5:B10', 'AB4:AB12']
sheetName: The spreadsheet name found at the top of the document in REF:extract, theres a field 'Sheet Name:' that the value indicates the name of the sheet.
Examples: 'Sheet 1', 'Forecasting', 'Persons A-G'
category: The category of the sensitive entity (e.g., personal, financial, health).
reference: Identify the sensitive entity, locate its corresponding justification in REF:policies by extracting the actual policy section (with its identifier) and the exact verbatim excerpt that explains its sensitivity, and output these details in the format: "<policy section header and identifier> - "<exact excerpt from REF:policies>""
Example: "Policy section: # - Snippet: 'This entity contains personal information.'"
confidence: A confidence number score from 1 to 10 for the final answer.
thinking: A short summary of the thinking process.
rankHex: A hex color code representing the severity of the sensitive field:
- Red (#FC1514) = very sensitive
- Yellow (#FFC659) = medium sensitivity
- Green (#A9FF46) = not very sensitive

---

Warnings
1. Ensure that each range in the 'ranges' array is in the proper format (Column+Row:Column+Row) with only one range per array index.
2. Ensure each identified entity is classified correctly according to REF:policies.
3. Provide the word-for-word excerpt from REF:policies that justifies each classification.
4. Use the proper rankHex values for each entity.
5. Include only one path value per identified sensitive entity.

---

Context
REF:policies
${policies}

REF:extract
${extract}
  `.trim();
}

// Utility function to get prompt by analysis type
export function getAnalysisPrompt(
  analysisType: 'CSV' | 'JSON' | 'UNSTRUCTURED' | 'SPREADSHEET',
  params: AnalysisPromptParams,
): string {
  switch (analysisType) {
    case 'CSV':
      return createCSVAnalysisPrompt(params);
    case 'JSON':
      return createJSONAnalysisPrompt(params);
    case 'UNSTRUCTURED':
      return createUnstructuredAnalysisPrompt(params);
    case 'SPREADSHEET':
      return createSpreadsheetAnalysisPrompt(params);
    default:
      throw new Error(`Unsupported analysis type: ${analysisType}`);
  }
}

// Export analysis types for convenience
export const ANALYSIS_TYPES = {
  CSV: 'CSV' as const,
  JSON: 'JSON' as const,
  UNSTRUCTURED: 'UNSTRUCTURED' as const,
  SPREADSHEET: 'SPREADSHEET' as const,
} as const;

export type AnalysisType = (typeof ANALYSIS_TYPES)[keyof typeof ANALYSIS_TYPES];
