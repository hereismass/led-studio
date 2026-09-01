import { z } from 'zod';

export const PROJECT_SCHEMA_VERSION = 2 as const;

export const PROJECT_LIMITS = {
  fileBytes: 32 * 1024 * 1024,
  groups: 256,
  keyframesPerTrack: 4096,
  layersPerScene: 512,
  loopLengthBeats: 4096,
  paletteTokens: 256,
  scenes: 256,
  totalEntities: 50_000,
} as const;

export const ProjectNameSchema = z
  .string()
  .trim()
  .min(1, 'Project name cannot be empty');

export const ProjectEntityIdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    'Entity IDs must be lowercase UUID v4 values',
  );

export const PaletteTokenIdSchema = ProjectEntityIdSchema;

export const PaletteTokenNameSchema = z
  .string()
  .trim()
  .min(1, 'Palette token names cannot be empty');

export const HexColourSchema = z
  .string()
  .regex(
    /^#[0-9A-F]{6}$/,
    'Palette colours must be uppercase six-digit hex values',
  );

export const PaletteTokenSchema = z
  .object({
    id: PaletteTokenIdSchema,
    name: PaletteTokenNameSchema,
    value: HexColourSchema,
  })
  .strict();

export const TimeSignatureSchema = z
  .object({
    denominator: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(4),
      z.literal(8),
      z.literal(16),
    ]),
    numerator: z.number().int().min(1).max(32),
  })
  .strict();

export const ProjectTimingSchema = z
  .object({
    previewBpm: z.number().int().min(20).max(300),
    timeSignature: TimeSignatureSchema,
  })
  .strict();

export const DEFAULT_PROJECT_TIMING = {
  previewBpm: 120,
  timeSignature: { denominator: 4, numerator: 4 },
} as const;

export const SceneBrightnessPercentSchema = z.number().int().min(0).max(100);

export const SceneLedStateSchema = z
  .object({
    brightnessPercent: SceneBrightnessPercentSchema,
    paletteTokenId: PaletteTokenIdSchema,
  })
  .strict();

export const SceneLoopLengthSchema = z
  .number()
  .positive()
  .max(
    PROJECT_LIMITS.loopLengthBeats,
    `Scene loops cannot exceed ${PROJECT_LIMITS.loopLengthBeats} beats`,
  )
  .refine((value) => Number.isInteger(value * 4), {
    message: 'Scene loop length must use quarter-beat increments',
  });

export const SceneNameSchema = z
  .string()
  .trim()
  .min(1, 'Scene names cannot be empty');

export const QuarterBeatSchema = z
  .number()
  .nonnegative()
  .refine((value) => Number.isInteger(value * 4), {
    message: 'Timing values must use quarter-beat increments',
  });

export const PositiveQuarterBeatSchema = QuarterBeatSchema.refine(
  (value) => value >= 0.25,
  { message: 'Timing values must be at least 0.25 beats' },
);

export const ProjectGroupNameSchema = z
  .string()
  .trim()
  .min(1, 'Group names cannot be empty');

export const ProjectGroupSchema = z
  .object({
    id: ProjectEntityIdSchema,
    ledIds: z.array(z.string().trim().min(1)).min(1),
    name: ProjectGroupNameSchema,
  })
  .strict()
  .superRefine((group, context) => {
    const ledIds = new Set<string>();
    group.ledIds.forEach((ledId, index) => {
      if (ledIds.has(ledId)) {
        context.addIssue({
          code: 'custom',
          message: `Group contains LED "${ledId}" more than once`,
          path: ['ledIds', index],
        });
      }
      ledIds.add(ledId);
    });
  });

export const DirectLedTargetSchema = z
  .object({
    kind: z.literal('leds'),
    ledIds: z.array(z.string().trim().min(1)).min(1),
  })
  .strict()
  .superRefine((target, context) => {
    const ledIds = new Set<string>();
    target.ledIds.forEach((ledId, index) => {
      if (ledIds.has(ledId)) {
        context.addIssue({
          code: 'custom',
          message: `Target contains LED "${ledId}" more than once`,
          path: ['ledIds', index],
        });
      }
      ledIds.add(ledId);
    });
  });

export const ProfileGroupTargetSchema = z
  .object({
    groupId: z.string().trim().min(1),
    kind: z.literal('profile-group'),
  })
  .strict();

export const ProjectGroupTargetSchema = z
  .object({ groupId: ProjectEntityIdSchema, kind: z.literal('project-group') })
  .strict();

export const LayerTargetSchema = z.discriminatedUnion('kind', [
  DirectLedTargetSchema,
  ProfileGroupTargetSchema,
  ProjectGroupTargetSchema,
]);

export const EffectTargetSchema = LayerTargetSchema;

export const PulseEffectSchema = z
  .object({
    cycleLengthBeats: PositiveQuarterBeatSchema,
    maxBrightnessPercent: z.number().int().min(0).max(100),
    minBrightnessPercent: z.number().int().min(0).max(100),
    paletteTokenId: PaletteTokenIdSchema,
    phaseOffsetBeats: QuarterBeatSchema,
    type: z.literal('pulse'),
    waveform: z.enum(['sine', 'triangle', 'square']),
  })
  .strict()
  .refine(
    (effect) => effect.minBrightnessPercent <= effect.maxBrightnessPercent,
    {
      message: 'Pulse minimum brightness cannot exceed maximum brightness',
      path: ['minBrightnessPercent'],
    },
  );

export const ChaseEffectSchema = z
  .object({
    brightnessPercent: z.number().int().min(0).max(100),
    direction: z.enum(['forward', 'reverse']),
    paletteTokenId: PaletteTokenIdSchema,
    stepLengthBeats: PositiveQuarterBeatSchema,
    trailLength: z.number().int().min(0),
    type: z.literal('chase'),
    width: z.number().int().min(1),
  })
  .strict();

export const EffectSchema = z.discriminatedUnion('type', [
  PulseEffectSchema,
  ChaseEffectSchema,
]);

export const SceneLayerNameSchema = z
  .string()
  .trim()
  .min(1, 'Layer names cannot be empty');

export const EffectLayerNameSchema = SceneLayerNameSchema;

const SceneLayerFields = {
  enabled: z.boolean(),
  endBeat: PositiveQuarterBeatSchema,
  id: ProjectEntityIdSchema,
  locked: z.boolean(),
  name: SceneLayerNameSchema,
  startBeat: QuarterBeatSchema,
  target: LayerTargetSchema,
} as const;

export const EffectLayerSchema = z
  .object({
    ...SceneLayerFields,
    effect: EffectSchema,
    kind: z.literal('effect'),
  })
  .strict()
  .refine((layer) => layer.endBeat > layer.startBeat, {
    message: 'Layer end must be after its start',
    path: ['endBeat'],
  });

export const KeyframeEasingSchema = z.enum([
  'linear',
  'ease-in',
  'ease-out',
  'ease-in-out',
]);

export const BrightnessKeyframeSchema = z
  .object({
    beat: QuarterBeatSchema,
    brightnessPercent: SceneBrightnessPercentSchema,
    easing: KeyframeEasingSchema.default('linear'),
    id: ProjectEntityIdSchema,
  })
  .strict();

export const ColourKeyframeSchema = z
  .object({
    beat: QuarterBeatSchema,
    easing: KeyframeEasingSchema.default('linear'),
    id: ProjectEntityIdSchema,
    paletteTokenId: PaletteTokenIdSchema,
  })
  .strict();

function orderedKeyframesSchema<T extends z.ZodType<{ beat: number }>>(
  keyframeSchema: T,
) {
  return z
    .array(keyframeSchema)
    .max(
      PROJECT_LIMITS.keyframesPerTrack,
      `Tracks cannot contain more than ${PROJECT_LIMITS.keyframesPerTrack} keyframes`,
    )
    .superRefine((keyframes, context) => {
      for (let index = 1; index < keyframes.length; index += 1) {
        if (keyframes[index].beat <= keyframes[index - 1].beat) {
          context.addIssue({
            code: 'custom',
            message: 'Keyframes must be ordered at unique beat positions',
            path: [index, 'beat'],
          });
        }
      }
    });
}

export const BrightnessKeyframeTrackSchema = z
  .object({ keyframes: orderedKeyframesSchema(BrightnessKeyframeSchema) })
  .strict();

export const ColourKeyframeTrackSchema = z
  .object({
    interpolation: z.enum(['linear-rgb', 'step']),
    keyframes: orderedKeyframesSchema(ColourKeyframeSchema),
  })
  .strict();

export const KeyframeLayerSchema = z
  .object({
    ...SceneLayerFields,
    kind: z.literal('keyframe'),
    tracks: z
      .object({
        brightness: BrightnessKeyframeTrackSchema,
        colour: ColourKeyframeTrackSchema,
      })
      .strict(),
  })
  .strict()
  .refine((layer) => layer.endBeat > layer.startBeat, {
    message: 'Layer end must be after its start',
    path: ['endBeat'],
  });

export const SceneLayerSchema = z.discriminatedUnion('kind', [
  EffectLayerSchema,
  KeyframeLayerSchema,
]);

export const SceneSchema = z
  .object({
    id: ProjectEntityIdSchema,
    layers: z
      .array(SceneLayerSchema)
      .max(
        PROJECT_LIMITS.layersPerScene,
        `Scenes cannot contain more than ${PROJECT_LIMITS.layersPerScene} layers`,
      )
      .default([]),
    ledStates: z.record(z.string().trim().min(1), SceneLedStateSchema),
    loopLengthBeats: SceneLoopLengthSchema,
    name: SceneNameSchema,
  })
  .strict();

const ReservedSequenceSchema = z
  .array(z.never())
  .max(0, 'This collection is reserved and must remain empty');

export const ProjectSchema = z
  .object({
    schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
    name: ProjectNameSchema,
    hardwareProfile: z
      .string()
      .trim()
      .min(1, 'Hardware profile cannot be empty'),
    palette: z
      .array(PaletteTokenSchema)
      .max(
        PROJECT_LIMITS.paletteTokens,
        `Projects cannot contain more than ${PROJECT_LIMITS.paletteTokens} palette tokens`,
      ),
    scenes: z
      .array(SceneSchema)
      .max(
        PROJECT_LIMITS.scenes,
        `Projects cannot contain more than ${PROJECT_LIMITS.scenes} scenes`,
      ),
    sequence: ReservedSequenceSchema,
    groups: z
      .array(ProjectGroupSchema)
      .max(
        PROJECT_LIMITS.groups,
        `Projects cannot contain more than ${PROJECT_LIMITS.groups} groups`,
      ),
    timing: ProjectTimingSchema.default(DEFAULT_PROJECT_TIMING),
  })
  .strict()
  .superRefine((project, context) => {
    const totalEntities =
      project.palette.length +
      project.groups.length +
      project.scenes.reduce(
        (sceneTotal, scene) =>
          sceneTotal +
          1 +
          scene.layers.reduce(
            (layerTotal, layer) =>
              layerTotal +
              1 +
              (layer.kind === 'keyframe'
                ? layer.tracks.brightness.keyframes.length +
                  layer.tracks.colour.keyframes.length
                : 0),
            0,
          ),
        0,
      );
    if (totalEntities > PROJECT_LIMITS.totalEntities) {
      context.addIssue({
        code: 'custom',
        message: `Projects cannot contain more than ${PROJECT_LIMITS.totalEntities} total entities`,
        path: ['scenes'],
      });
    }

    const ids = new Set<string>();
    const names = new Set<string>();

    project.palette.forEach((token, index) => {
      if (ids.has(token.id)) {
        context.addIssue({
          code: 'custom',
          message: `Palette token ID "${token.id}" is already in use`,
          path: ['palette', index, 'id'],
        });
      }
      ids.add(token.id);

      const normalizedName = token.name.toLowerCase();
      if (names.has(normalizedName)) {
        context.addIssue({
          code: 'custom',
          message: `Palette token name "${token.name}" is already in use`,
          path: ['palette', index, 'name'],
        });
      }
      names.add(normalizedName);
    });

    const entityIds = new Set(ids);
    const groupNames = new Set<string>();
    project.groups.forEach((group, groupIndex) => {
      if (entityIds.has(group.id)) {
        context.addIssue({
          code: 'custom',
          message: `Entity ID "${group.id}" is already in use`,
          path: ['groups', groupIndex, 'id'],
        });
      }
      entityIds.add(group.id);
      const name = group.name.toLowerCase();
      if (groupNames.has(name)) {
        context.addIssue({
          code: 'custom',
          message: `Group name "${group.name}" is already in use`,
          path: ['groups', groupIndex, 'name'],
        });
      }
      groupNames.add(name);
    });

    const sceneNames = new Set<string>();
    project.scenes.forEach((scene, sceneIndex) => {
      if (entityIds.has(scene.id)) {
        context.addIssue({
          code: 'custom',
          message: `Entity ID "${scene.id}" is already in use`,
          path: ['scenes', sceneIndex, 'id'],
        });
      }
      entityIds.add(scene.id);

      const normalizedSceneName = scene.name.toLowerCase();
      if (sceneNames.has(normalizedSceneName)) {
        context.addIssue({
          code: 'custom',
          message: `Scene name "${scene.name}" is already in use`,
          path: ['scenes', sceneIndex, 'name'],
        });
      }
      sceneNames.add(normalizedSceneName);

      Object.values(scene.ledStates).forEach((state, stateIndex) => {
        if (!ids.has(state.paletteTokenId)) {
          context.addIssue({
            code: 'custom',
            message: `Scene references unknown palette token "${state.paletteTokenId}"`,
            path: [
              'scenes',
              sceneIndex,
              'ledStates',
              Object.keys(scene.ledStates)[stateIndex],
              'paletteTokenId',
            ],
          });
        }
      });

      const layerNames = new Set<string>();
      scene.layers.forEach((layer, layerIndex) => {
        if (entityIds.has(layer.id)) {
          context.addIssue({
            code: 'custom',
            message: `Entity ID "${layer.id}" is already in use`,
            path: ['scenes', sceneIndex, 'layers', layerIndex, 'id'],
          });
        }
        entityIds.add(layer.id);

        const layerName = layer.name.toLowerCase();
        if (layerNames.has(layerName)) {
          context.addIssue({
            code: 'custom',
            message: `Layer name "${layer.name}" is already in use`,
            path: ['scenes', sceneIndex, 'layers', layerIndex, 'name'],
          });
        }
        layerNames.add(layerName);

        if (layer.endBeat > scene.loopLengthBeats) {
          context.addIssue({
            code: 'custom',
            message: 'Layer must end within the scene loop',
            path: ['scenes', sceneIndex, 'layers', layerIndex, 'endBeat'],
          });
        }
        if (layer.kind === 'effect') {
          if (!ids.has(layer.effect.paletteTokenId)) {
            context.addIssue({
              code: 'custom',
              message: `Effect layer references unknown palette token "${layer.effect.paletteTokenId}"`,
              path: [
                'scenes',
                sceneIndex,
                'layers',
                layerIndex,
                'effect',
                'paletteTokenId',
              ],
            });
          }
        } else {
          const keyframeTracks = [
            ['brightness', layer.tracks.brightness.keyframes] as const,
            ['colour', layer.tracks.colour.keyframes] as const,
          ];
          keyframeTracks.forEach(([trackName, keyframes]) => {
            keyframes.forEach((keyframe, keyframeIndex) => {
              if (entityIds.has(keyframe.id)) {
                context.addIssue({
                  code: 'custom',
                  message: `Entity ID "${keyframe.id}" is already in use`,
                  path: [
                    'scenes',
                    sceneIndex,
                    'layers',
                    layerIndex,
                    'tracks',
                    trackName,
                    'keyframes',
                    keyframeIndex,
                    'id',
                  ],
                });
              }
              entityIds.add(keyframe.id);
              if (keyframe.beat > scene.loopLengthBeats) {
                context.addIssue({
                  code: 'custom',
                  message: 'Keyframe must be within the scene loop',
                  path: [
                    'scenes',
                    sceneIndex,
                    'layers',
                    layerIndex,
                    'tracks',
                    trackName,
                    'keyframes',
                    keyframeIndex,
                    'beat',
                  ],
                });
              }
              if (
                trackName === 'colour' &&
                'paletteTokenId' in keyframe &&
                !ids.has(keyframe.paletteTokenId)
              ) {
                context.addIssue({
                  code: 'custom',
                  message: `Colour keyframe references unknown palette token "${keyframe.paletteTokenId}"`,
                  path: [
                    'scenes',
                    sceneIndex,
                    'layers',
                    layerIndex,
                    'tracks',
                    'colour',
                    'keyframes',
                    keyframeIndex,
                    'paletteTokenId',
                  ],
                });
              }
            });
          });
        }
        const projectGroupId =
          layer.target.kind === 'project-group' ? layer.target.groupId : null;
        if (
          projectGroupId !== null &&
          !project.groups.some((group) => group.id === projectGroupId)
        ) {
          context.addIssue({
            code: 'custom',
            message: `Layer references unknown project group "${projectGroupId}"`,
            path: [
              'scenes',
              sceneIndex,
              'layers',
              layerIndex,
              'target',
              'groupId',
            ],
          });
        }
      });
    });
  });

export type BrightnessKeyframe = z.infer<typeof BrightnessKeyframeSchema>;
export type KeyframeEasing = z.infer<typeof KeyframeEasingSchema>;
export type BrightnessKeyframeTrack = z.infer<
  typeof BrightnessKeyframeTrackSchema
>;
export type ChaseEffect = z.infer<typeof ChaseEffectSchema>;
export type ColourKeyframe = z.infer<typeof ColourKeyframeSchema>;
export type ColourKeyframeTrack = z.infer<typeof ColourKeyframeTrackSchema>;
export type Effect = z.infer<typeof EffectSchema>;
export type EffectLayer = z.infer<typeof EffectLayerSchema>;
export type EffectTarget = z.infer<typeof EffectTargetSchema>;
export type KeyframeLayer = z.infer<typeof KeyframeLayerSchema>;
export type LayerTarget = z.infer<typeof LayerTargetSchema>;
export type PaletteToken = z.infer<typeof PaletteTokenSchema>;
export type ProjectTiming = z.infer<typeof ProjectTimingSchema>;
export type ProjectGroup = z.infer<typeof ProjectGroupSchema>;
export type PulseEffect = z.infer<typeof PulseEffectSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type SceneLayer = z.infer<typeof SceneLayerSchema>;
export type SceneLedState = z.infer<typeof SceneLedStateSchema>;
export type Project = z.infer<typeof ProjectSchema>;

export type ProjectFormatErrorKind = 'invalid-json' | 'invalid-project';

export interface ProjectValidationIssue {
  message: string;
  path: (number | string)[];
}

export class ProjectFormatError extends Error {
  readonly issues: ProjectValidationIssue[];
  readonly kind: ProjectFormatErrorKind;

  constructor(
    kind: ProjectFormatErrorKind,
    message: string,
    issues: ProjectValidationIssue[] = [],
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ProjectFormatError';
    this.kind = kind;
    this.issues = issues;
  }
}

function unsupportedVersionIssue(
  input: unknown,
): ProjectValidationIssue | null {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('schemaVersion' in input)
  ) {
    return null;
  }

  const version = input.schemaVersion;
  if (version === PROJECT_SCHEMA_VERSION) {
    return null;
  }

  return {
    message: `Project format version ${String(version)} is not supported; this build supports version ${PROJECT_SCHEMA_VERSION}`,
    path: ['schemaVersion'],
  };
}

export function parseProject(input: unknown): Project {
  const versionIssue = unsupportedVersionIssue(input);
  if (versionIssue) {
    throw new ProjectFormatError('invalid-project', versionIssue.message, [
      versionIssue,
    ]);
  }

  const result = ProjectSchema.safeParse(input);

  if (!result.success) {
    throw new ProjectFormatError(
      'invalid-project',
      'The project does not match the supported project format.',
      result.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path.map((part) =>
          typeof part === 'symbol' ? String(part) : part,
        ),
      })),
      { cause: result.error },
    );
  }

  return result.data;
}

export function parseProjectJson(json: string): Project {
  let input: unknown;

  try {
    input = JSON.parse(json) as unknown;
  } catch (error) {
    throw new ProjectFormatError(
      'invalid-json',
      'The project file is not valid JSON.',
      [],
      { cause: error },
    );
  }

  return parseProject(input);
}

export function serializeProject(project: Project): string {
  return `${JSON.stringify(parseProject(project), null, 2)}\n`;
}
