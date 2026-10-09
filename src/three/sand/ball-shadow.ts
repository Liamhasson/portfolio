import * as THREE from "three";

/**
 * The formed ball's shadow on the desk plate (the plate was rendered without the ball). For each point of the desk it
 * computes how much of the lamp (a sphere light) the ball hides, so the shadow is as soft as Cycles' and falls where the
 * render's does, then darkens the plate by that share of the lamp's light (multiply).
 */
const VERTEX = /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const FRAGMENT = /* glsl */ `
precision highp float;
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec3 vWorld;
uniform vec3 uBall;
uniform float uBallR;
uniform vec3 uLamp;
uniform float uLampR;
uniform float uStrength;   // the lamp's share of the desk's light, x how formed the ball is
void main() {
  vec3 toB = uBall - vWorld, toL = uLamp - vWorld;
  float dB = length(toB), dL = length(toL);
  float aB = asin(clamp(uBallR / dB, 0.0, 1.0));   // angular radii seen from this point of the desk
  float aL = asin(clamp(uLampR / dL, 0.0, 1.0));
  float sep = acos(clamp(dot(toB / dB, toL / dL), -1.0, 1.0));
  // the share of the lamp's disc the ball's disc covers: the exact area of overlap of two discs
  float r1 = aB, r2 = aL, d = sep, cover;
  if (d >= r1 + r2) cover = 0.0;
  else if (d <= abs(r1 - r2)) cover = min(r1 * r1, r2 * r2) / (r2 * r2);
  else {
    float c1 = clamp((d * d + r1 * r1 - r2 * r2) / (2.0 * d * r1), -1.0, 1.0);
    float c2 = clamp((d * d + r2 * r2 - r1 * r1) / (2.0 * d * r2), -1.0, 1.0);
    float area = r1 * r1 * acos(c1) + r2 * r2 * acos(c2)
      - 0.5 * sqrt(max((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2), 0.0));
    cover = area / (3.14159265 * r2 * r2);
  }
  gl_FragColor = vec4(vec3(1.0 - uStrength * cover), 1.0);
}
`;

export class BallShadow {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  /** `deskY`: the desk's surface height (the hero's units, y up). */
  constructor(deskY: number) {
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.SrcColorFactor,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uBall: { value: new THREE.Vector3() },
        uBallR: { value: 1 },
        uLamp: { value: new THREE.Vector3() },
        uLampR: { value: 1 },
        uStrength: { value: 0 },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), this.material);
    this.mesh.position.y = deskY;
    this.mesh.renderOrder = -50;   // over the plate, under the live sand (which is composited last)
    this.mesh.frustumCulled = false;
  }

  update(ball: THREE.Vector3, ballR: number, lamp: THREE.Vector3, lampR: number, strength: number): void {
    const u = this.material.uniforms;
    (u.uBall.value as THREE.Vector3).copy(ball);
    u.uBallR.value = ballR;
    (u.uLamp.value as THREE.Vector3).copy(lamp);
    u.uLampR.value = lampR;
    u.uStrength.value = strength;
    this.mesh.visible = strength > 0.001;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
