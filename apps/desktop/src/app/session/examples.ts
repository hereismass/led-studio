import { parseProjectJson } from '@led-studio/project-format';
import kmsBassExampleJson from '../../../../../examples/kms-4-string-10-led-v1.ledstudio?raw';

export const projectExamples = [
  {
    description: 'A four-beat marker scene for the 10-LED KMS profile.',
    id: 'kms-4-string-10-led-v1',
    project: parseProjectJson(kmsBassExampleJson),
  },
] as const;
