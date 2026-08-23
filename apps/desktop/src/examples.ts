import { parseProjectJson } from '@led-studio/project-format';
import kmsBassExampleJson from '../../../examples/kms-4-string-31-inlay-v1.ledstudio?raw';

export const projectExamples = [
  {
    description: 'A four-beat marker scene for the 31-inlay KMS profile.',
    id: 'kms-4-string-31-inlay-v1',
    project: parseProjectJson(kmsBassExampleJson),
  },
] as const;
