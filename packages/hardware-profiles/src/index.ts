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
    lane: z.enum(['primary', 'secondary']).optional(),
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

export const KMS_PROFILE_ID = 'kms-4-string-31-inlay-v1' as const;
export const KMS_MARKER_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21] as const;

function primaryLedId(fret: number): string {
  return `fret-${String(fret).padStart(2, '0')}-primary`;
}

function secondaryLedId(fret: number): string {
  return `fret-${String(fret).padStart(2, '0')}-secondary`;
}

function createKmsProfile(): HardwareProfile {
  const fretCount = 22;
  const maximumDistance = 1 - 2 ** (-fretCount / 12);
  const fretBoundaries = Array.from({ length: fretCount + 1 }, (_, fret) => {
    const distanceFromNut = 1 - 2 ** (-fret / 12);
    return 1 - distanceFromNut / maximumDistance;
  });
  const markerFrets = new Set<number>(KMS_MARKER_FRETS);
  const leds: HardwareLed[] = [];

  for (let fret = 1; fret <= fretCount; fret += 1) {
    const x = (fretBoundaries[fret - 1] + fretBoundaries[fret]) / 2;
    leds.push({
      address: leds.length,
      fret,
      id: primaryLedId(fret),
      label: `Fret ${fret} primary inlay`,
      lane: 'primary',
      position: { x, y: 0.42 },
    });
    if (markerFrets.has(fret)) {
      leds.push({
        address: leds.length,
        fret,
        id: secondaryLedId(fret),
        label: `Fret ${fret} secondary inlay`,
        lane: 'secondary',
        position: { x, y: 0.58 },
      });
    }
  }

  const primaryIds = leds
    .filter((led) => led.lane === 'primary')
    .map((led) => led.id);
  const secondaryIds = leds
    .filter((led) => led.lane === 'secondary')
    .map((led) => led.id);
  const markerIds = leds
    .filter((led) => led.fret !== undefined && markerFrets.has(led.fret))
    .map((led) => led.id);

  return HardwareProfileSchema.parse({
    groups: [
      {
        id: 'all-inlays',
        ledIds: leds.map((led) => led.id),
        name: 'All Inlays',
      },
      { id: 'primary-inlays', ledIds: primaryIds, name: 'Primary Inlays' },
      {
        id: 'secondary-markers',
        ledIds: secondaryIds,
        name: 'Secondary Markers',
      },
      {
        id: 'all-marker-frets',
        ledIds: markerIds,
        name: 'All Marker Frets',
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
    name: 'KMS 4-String · 31 Inlays',
  });
}

export const kmsFourString31InlayProfile = createKmsProfile();

const profiles: readonly HardwareProfile[] = [kmsFourString31InlayProfile];
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
  hardwareProfile: string;
  scenes: Array<{ ledStates: Record<string, unknown>; name: string }>;
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
  project.scenes.forEach((scene) => {
    Object.keys(scene.ledStates).forEach((ledId) => {
      if (!ledIds.has(ledId)) {
        throw new HardwareCompatibilityError(
          `Scene "${scene.name}" references LED "${ledId}", which is not part of ${profile.name}.`,
        );
      }
    });
  });

  return profile;
}
