import { parseProject } from '@led-studio/project-format';
import kmsBassExampleJson from '../../../examples/kms-4-string-31-inlay-v1.ledstudio.json';

export const projectExamples = [
  {
    description: 'A starter palette for the 31-inlay KMS bass profile.',
    id: 'kms-4-string-31-inlay-v1',
    project: parseProject(kmsBassExampleJson),
  },
] as const;
