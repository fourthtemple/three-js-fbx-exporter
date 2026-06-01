import { normalizeFbxScene } from "./scene-normalizer.js";

export function createCubeScene({ name = "StaticMeshSample", animated = false, textured = false } = {}) {
  const vertices = [
    -1, -1, 1,
    1, -1, 1,
    1, 1, 1,
    -1, 1, 1,
    -1, -1, -1,
    1, -1, -1,
    1, 1, -1,
    -1, 1, -1
  ];
  const faces = [
    [0, 1, 2, 3],
    [1, 5, 6, 2],
    [5, 4, 7, 6],
    [4, 0, 3, 7],
    [3, 2, 6, 7],
    [4, 5, 1, 0]
  ];
  const uvs = faces.flatMap(() => [0, 0, 1, 0, 1, 1, 0, 1]);

  return normalizeFbxScene({
    name,
    meshes: [
      {
        name: "Cube",
        materials: [
          {
            name: "WarmGray",
            diffuseColor: [0.75, 0.68, 0.58],
            specularColor: [0.08, 0.08, 0.08],
            opacity: 1,
            diffuseTexture: textured ? "checker.tga" : null
          }
        ],
        geometry: {
          vertices,
          faces,
          uvs,
          materialIndices: [0, 0, 0, 0, 0, 0]
        }
      }
    ],
    animations: animated ? [
      {
        name: "CubeTravel",
        frameRate: 30,
        startFrame: 0,
        endFrame: 30,
        tracks: [
          {
            mesh: "Cube",
            property: "translation",
            keyframes: [
              { frame: 0, value: [0, 0, 0] },
              { frame: 15, value: [1, 0.5, 0] },
              { frame: 30, value: [2, 0, 0] }
            ]
          },
          {
            mesh: "Cube",
            property: "rotation",
            keyframes: [
              { frame: 0, value: [0, 0, 0] },
              { frame: 30, value: [0, 90, 0] }
            ]
          }
        ]
      }
    ] : []
  });
}

export function createHierarchyScene({ name = "HierarchySample", animated = true } = {}) {
  return normalizeFbxScene({
    name,
    nodes: [
      {
        name: "ParentCtrl",
        transform: {
          translation: [1, 2, 3],
          rotation: [0, 45, 0],
          scale: [1, 1, 1]
        }
      }
    ],
    meshes: [
      {
        name: "Cube",
        parent: "ParentCtrl",
        materials: [{ name: "Mat" }],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ],
    animations: animated ? [
      {
        name: "ParentMove",
        frameRate: 30,
        startFrame: 0,
        endFrame: 30,
        tracks: [
          {
            target: "ParentCtrl",
            property: "translation",
            keyframes: [
              { frame: 0, value: [1, 2, 3] },
              { frame: 30, value: [2, 2, 3] }
            ]
          }
        ]
      }
    ] : []
  });
}

export function createMaterialScene({ name = "MaterialSample" } = {}) {
  return normalizeFbxScene({
    name,
    meshes: [
      {
        name: "MaterialQuad",
        materials: [
          {
            name: "RichMaterial",
            diffuseColor: [1, 0, 0],
            emissiveColor: [0, 0, 1],
            ambientColor: [0.1, 0.2, 0.3],
            specularColor: [0, 1, 0],
            transparentColor: [0.05, 0.1, 0.15],
            opacity: 0.42,
            transparencyFactor: 0.58,
            diffuseFactor: 0.8,
            emissiveFactor: 0.6,
            ambientFactor: 0.7,
            specularFactor: 0.5,
            shininess: 77
          }
        ],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0]
        }
      }
    ]
  });
}

export function createMorphScene({ name = "MorphSample", animated = true } = {}) {
  return normalizeFbxScene({
    name,
    meshes: [
      {
        name: "MorphQuad",
        materials: [{ name: "MorphMaterial" }],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          materialIndices: [0],
          morphTargets: [
            {
              name: "Puff",
              indices: [2, 3],
              vertices: [0, 0, 0.5, 0, 0, 0.5]
            }
          ]
        }
      }
    ],
    animations: animated ? [
      {
        name: "PuffAction",
        frameRate: 30,
        startFrame: 0,
        endFrame: 30,
        tracks: [
          {
            target: "MorphQuad",
            property: "morph",
            morphTarget: "Puff",
            keyframes: [
              { frame: 0, value: 0 },
              { frame: 30, value: 1 }
            ]
          }
        ]
      }
    ] : []
  });
}

export function createVertexColorScene({ name = "VertexColorSample" } = {}) {
  return normalizeFbxScene({
    name,
    meshes: [
      {
        name: "ColorQuad",
        materials: [{ name: "ColorMaterial" }],
        geometry: {
          vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
          faces: [[0, 1, 2, 3]],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          colors: [
            1, 0, 0,
            0, 1, 0,
            0, 0, 1,
            1, 1, 0
          ],
          materialIndices: [0]
        }
      }
    ]
  });
}

export function createSkinnedCubeScene({ name = "SkinnedCubeSample", animated = false, textured = false } = {}) {
  const vertices = [
    -0.5, 0, 0.5,
    0.5, 0, 0.5,
    0.5, 2, 0.5,
    -0.5, 2, 0.5,
    -0.5, 0, -0.5,
    0.5, 0, -0.5,
    0.5, 2, -0.5,
    -0.5, 2, -0.5
  ];
  const faces = [
    [0, 1, 2, 3],
    [1, 5, 6, 2],
    [5, 4, 7, 6],
    [4, 0, 3, 7],
    [3, 2, 6, 7],
    [4, 5, 1, 0]
  ];
  const uvs = faces.flatMap(() => [0, 0, 1, 0, 1, 1, 0, 1]);

  return normalizeFbxScene({
    name,
    meshes: [
      {
        name: "SkinnedCube",
        materials: [
          {
            name: "SkinMaterial",
            diffuseColor: [0.55, 0.7, 0.95],
            specularColor: [0.08, 0.08, 0.08],
            opacity: 1,
            diffuseTexture: textured ? "checker.tga" : null
          }
        ],
        geometry: {
          vertices,
          faces,
          uvs,
          materialIndices: [0, 0, 0, 0, 0, 0]
        },
        skin: {
          bones: [
            {
              name: "Root",
              transform: { translation: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
            },
            {
              name: "Spine",
              parent: "Root",
              transform: { translation: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
            }
          ],
          clusters: [
            { bone: "Root", indices: [0, 1, 4, 5], weights: [1, 1, 1, 1] },
            { bone: "Spine", indices: [2, 3, 6, 7], weights: [1, 1, 1, 1] }
          ]
        }
      }
    ],
    animations: animated ? [
      {
        name: "BoneBend",
        frameRate: 30,
        startFrame: 0,
        endFrame: 30,
        tracks: [
          {
            target: "Spine",
            property: "rotation",
            keyframes: [
              { frame: 0, value: [0, 0, 0] },
              { frame: 15, value: [0, 0, 30] },
              { frame: 30, value: [0, 0, 0] }
            ]
          }
        ]
      }
    ] : []
  });
}

export function createSkinnedMorphScene({ name = "SkinnedMorphSample", animated = true, textured = true } = {}) {
  const scene = createSkinnedCubeScene({ name, animated: false, textured });
  const mesh = scene.meshes[0];
  mesh.name = "CharacterMesh";
  mesh.materials[0].name = "CharacterMaterial";
  mesh.geometry.morphTargets = [
    {
      name: "ChestLift",
      indices: [2, 3, 6, 7],
      vertices: [
        0, 0.18, 0.22,
        0, 0.18, 0.22,
        0, 0.18, -0.22,
        0, 0.18, -0.22
      ],
      weight: 0.1
    }
  ];
  scene.animations = animated ? [
    {
      name: "CharacterPerformance",
      frameRate: 30,
      startFrame: 0,
      endFrame: 30,
      tracks: [
        {
          target: "Spine",
          property: "rotation",
          keyframes: [
            { frame: 0, value: [0, 0, 0] },
            { frame: 15, value: [0, 0, 30] },
            { frame: 30, value: [0, 0, 0] }
          ]
        },
        {
          target: "CharacterMesh",
          property: "morph",
          morphTarget: "ChestLift",
          keyframes: [
            { frame: 0, value: 0.1 },
            { frame: 15, value: 1 },
            { frame: 30, value: 0.1 }
          ]
        },
        ...(textured ? [
          {
            target: "checker",
            property: "textureTranslation",
            keyframes: [
              { frame: 0, value: [0, 0, 0] },
              { frame: 30, value: [0.25, 0.125, 0] }
            ]
          }
        ] : [])
      ]
    }
  ] : [];
  return scene;
}
