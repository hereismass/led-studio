import { z } from 'zod';

const StableIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'IDs must use lowercase kebab-case');

export const HardwareLedSchema = z
  .object({
    address: z.number().int().nonnegative(),
    fret: z.number().int().positive().optional(),
    id: StableIdSchema,
    label: z.string().trim().min(1),
    lane: StableIdSchema.optional(),
    position: z
      .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
      .strict(),
  })
  .strict();

export const HardwareGroupSchema = z
  .object({
    id: StableIdSchema,
    ledIds: z.array(StableIdSchema).min(1),
    name: z.string().trim().min(1),
  })
  .strict();

export const FretboardLayoutSchema = z
  .object({
    fretBoundaries: z.array(z.number().min(0).max(1)).min(2),
    fretCount: z.number().int().positive(),
    kind: z.literal('fretboard-v1'),
    orientation: z.literal('nut-right'),
    stringCount: z.number().int().positive(),
  })
  .strict()
  .superRefine((layout, context) => {
    if (layout.fretBoundaries.length !== layout.fretCount + 1) {
      context.addIssue({
        code: 'custom',
        message: 'Fret boundaries must include the nut and every fret line',
        path: ['fretBoundaries'],
      });
    }

    layout.fretBoundaries.forEach((boundary, index) => {
      if (index > 0 && boundary >= layout.fretBoundaries[index - 1]) {
        context.addIssue({
          code: 'custom',
          message: 'Nut-right fret boundaries must decrease toward the body',
          path: ['fretBoundaries', index],
        });
      }
    });
  });

export const HardwareProfileSchema = z
  .object({
    groups: z.array(HardwareGroupSchema),
    id: StableIdSchema,
    layout: FretboardLayoutSchema,
    leds: z.array(HardwareLedSchema).min(1),
    name: z.string().trim().min(1),
  })
  .strict()
  .superRefine((profile, context) => {
    const ledIds = new Set<string>();
    const addresses = new Set<number>();

    profile.leds.forEach((led, index) => {
      if (ledIds.has(led.id)) {
        context.addIssue({
          code: 'custom',
          message: `LED ID "${led.id}" is already in use`,
          path: ['leds', index, 'id'],
        });
      }
      if (addresses.has(led.address)) {
        context.addIssue({
          code: 'custom',
          message: `LED address ${led.address} is already in use`,
          path: ['leds', index, 'address'],
        });
      }
      ledIds.add(led.id);
      addresses.add(led.address);
    });

    const expectedAddresses = Array.from(
      { length: profile.leds.length },
      (_, address) => address,
    );
    if (expectedAddresses.some((address) => !addresses.has(address))) {
      context.addIssue({
        code: 'custom',
        message: 'LED addresses must be contiguous from zero',
        path: ['leds'],
      });
    }

    const groupIds = new Set<string>();
    profile.groups.forEach((group, groupIndex) => {
      if (groupIds.has(group.id)) {
        context.addIssue({
          code: 'custom',
          message: `Group ID "${group.id}" is already in use`,
          path: ['groups', groupIndex, 'id'],
        });
      }
      groupIds.add(group.id);

      const members = new Set<string>();
      group.ledIds.forEach((ledId, memberIndex) => {
        if (!ledIds.has(ledId)) {
          context.addIssue({
            code: 'custom',
            message: `Group references unknown LED "${ledId}"`,
            path: ['groups', groupIndex, 'ledIds', memberIndex],
          });
        }
        if (members.has(ledId)) {
          context.addIssue({
            code: 'custom',
            message: `Group contains LED "${ledId}" more than once`,
            path: ['groups', groupIndex, 'ledIds', memberIndex],
          });
        }
        members.add(ledId);
      });
    });
  });

export type HardwareLed = z.infer<typeof HardwareLedSchema>;
export type HardwareGroup = z.infer<typeof HardwareGroupSchema>;
export type FretboardLayout = z.infer<typeof FretboardLayoutSchema>;
export type HardwareProfile = z.infer<typeof HardwareProfileSchema>;

export const KMS_PROFILE_ID = 'kms-4-string-10-led-v1' as const;
export const KMS_E_SIDE_FRETS = [3, 5, 7, 9, 12] as const;
export const KMS_G_SIDE_FRETS = [12, 15, 17, 19, 21] as const;

const KMS_LED_CHAIN = [
  { fret: 21, lane: 'g-side' },
  { fret: 19, lane: 'g-side' },
  { fret: 17, lane: 'g-side' },
  { fret: 15, lane: 'g-side' },
  { fret: 12, lane: 'g-side' },
  { fret: 12, lane: 'e-side' },
  { fret: 9, lane: 'e-side' },
  { fret: 7, lane: 'e-side' },
  { fret: 5, lane: 'e-side' },
  { fret: 3, lane: 'e-side' },
] as const;

function ledId(fret: number, lane: 'e-side' | 'g-side'): string {
  return `fret-${String(fret).padStart(2, '0')}-${lane}`;
}

function createKmsProfile(): HardwareProfile {
  const fretCount = 22;
  const maximumDistance = 1 - 2 ** (-fretCount / 12);
  const fretBoundaries = Array.from({ length: fretCount + 1 }, (_, fret) => {
    const distanceFromNut = 1 - 2 ** (-fret / 12);
    return 1 - distanceFromNut / maximumDistance;
  });
  const leds: HardwareLed[] = KMS_LED_CHAIN.map(({ fret, lane }, address) => {
    const x = (fretBoundaries[fret - 1] + fretBoundaries[fret]) / 2;
    const sideName = lane === 'e-side' ? 'E-side' : 'G-side';
    return {
      address,
      fret,
      id: ledId(fret, lane),
      label: `Fret ${fret} ${sideName} LED`,
      lane,
      position: { x, y: lane === 'e-side' ? 0.1 : 0.9 },
    };
  });

  const eSideIds = leds
    .filter((led) => led.lane === 'e-side')
    .map((led) => led.id);
  const gSideIds = leds
    .filter((led) => led.lane === 'g-side')
    .map((led) => led.id);

  return HardwareProfileSchema.parse({
    groups: [
      {
        id: 'all-leds',
        ledIds: leds.map((led) => led.id),
        name: 'All LEDs',
      },
      {
        id: 'e-side-leds',
        ledIds: eSideIds,
        name: 'E-side LEDs',
      },
      {
        id: 'g-side-leds',
        ledIds: gSideIds,
        name: 'G-side LEDs',
      },
    ],
    id: KMS_PROFILE_ID,
    layout: {
      fretBoundaries,
      fretCount,
      kind: 'fretboard-v1',
      orientation: 'nut-right',
      stringCount: 4,
    },
    leds,
    name: 'KMS 4-String · 10 LEDs',
  });
}

export const kmsFourString10LedProfile = createKmsProfile();

const profiles: readonly HardwareProfile[] = [kmsFourString10LedProfile];
const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

export function listHardwareProfiles(): readonly HardwareProfile[] {
  return profiles;
}

export function getHardwareProfile(id: string): HardwareProfile | undefined {
  return profileById.get(id);
}

export class HardwareCompatibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HardwareCompatibilityError';
  }
}

interface HardwareBoundProject {
  groups?: Array<{ id: string; ledIds: string[]; name: string }>;
  hardwareProfile: string;
  scenes: Array<{
    layers?: Array<{
      name: string;
      target:
        | { kind: 'leds'; ledIds: string[] }
        | { kind: 'profile-group'; groupId: string }
        | { kind: 'project-group'; groupId: string };
    }>;
    ledStates: Record<string, unknown>;
    name: string;
  }>;
}

export function validateProjectHardwareReferences(
  project: HardwareBoundProject,
): HardwareProfile {
  const profile = getHardwareProfile(project.hardwareProfile);
  if (!profile) {
    throw new HardwareCompatibilityError(
      `Hardware profile "${project.hardwareProfile}" is not available in this build.`,
    );
  }

  const ledIds = new Set(profile.leds.map((led) => led.id));
  const ledAddress = new Map(profile.leds.map((led) => [led.id, led.address]));
  const validateLedList = (values: string[], subject: string) => {
    values.forEach((ledId) => {
      if (!ledIds.has(ledId)) {
        throw new HardwareCompatibilityError(
          `${subject} references LED "${ledId}", which is not part of ${profile.name}.`,
        );
      }
    });
    for (let index = 1; index < values.length; index += 1) {
      if (
        ledAddress.get(values[index - 1])! >= ledAddress.get(values[index])!
      ) {
        throw new HardwareCompatibilityError(
          `${subject} LEDs must follow the hardware address order.`,
        );
      }
    }
  };

  (project.groups ?? []).forEach((group) =>
    validateLedList(group.ledIds, `Group "${group.name}"`),
  );
  const profileGroupIds = new Set(profile.groups.map((group) => group.id));
  project.scenes.forEach((scene) => {
    Object.keys(scene.ledStates).forEach((ledId) => {
      if (!ledIds.has(ledId)) {
        throw new HardwareCompatibilityError(
          `Scene "${scene.name}" references LED "${ledId}", which is not part of ${profile.name}.`,
        );
      }
    });
    (scene.layers ?? []).forEach((layer) => {
      if (layer.target.kind === 'leds') {
        validateLedList(
          layer.target.ledIds,
          `Layer "${layer.name}" in scene "${scene.name}"`,
        );
      } else if (
        layer.target.kind === 'profile-group' &&
        !profileGroupIds.has(layer.target.groupId)
      ) {
        throw new HardwareCompatibilityError(
          `Layer "${layer.name}" references profile group "${layer.target.groupId}", which is not part of ${profile.name}.`,
        );
      }
    });
  });

  return profile;
}
