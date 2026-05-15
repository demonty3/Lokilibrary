import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { CapsuleCollider, RigidBody, useRapier } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import type { Movement } from '../App';
import { useAppStore } from '../state/store';
import { playerPosition } from '../state/playerPos';

const WALK_SPEED = 4;
const GRAVITY = 9.81;
const EYE_HEIGHT_OFFSET = 0.7; // camera above body center (capsule center at y=0.9 + 0.7 = 1.6m eye height)
const SPAWN: [number, number, number] = [0, 1.0, 8];

/**
 * Kinematic capsule character. WASD-driven via the camera's yaw; mouse-look is
 * handled separately by drei's PointerLockControls. Movement is filtered through
 * a Rapier KinematicCharacterController so walls and buildings actually block.
 */
export function Player() {
  const rb = useRef<RapierRigidBody>(null);
  const { world } = useRapier();
  const controllerRef = useRef<ReturnType<typeof world.createCharacterController> | null>(null);
  const [, get] = useKeyboardControls<Movement>();
  const { camera } = useThree();
  const forward = useRef(new Vector3());
  const right = useRef(new Vector3());
  const desired = useRef(new Vector3());

  useEffect(() => {
    const c = world.createCharacterController(0.01);
    c.enableSnapToGround(0.5);
    c.enableAutostep(0.3, 0.3, true);
    c.setSlideEnabled(true);
    controllerRef.current = c;
    return () => {
      world.removeCharacterController(c);
      controllerRef.current = null;
    };
  }, [world]);

  useFrame((_state, dt) => {
    const body = rb.current;
    const controller = controllerRef.current;
    if (!body || !controller) return;
    const collider = body.collider(0);
    if (!collider) return;

    // Pause WASD while the connector panel is open — pointer is unlocked but
    // keydowns still fire on the document and would otherwise drift the player.
    if (useAppStore.getState().menuOpen) {
      const t = body.translation();
      playerPosition.set(t.x, t.y, t.z);
      return;
    }

    const keys = get();
    forward.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.current.y = 0;
    forward.current.normalize();
    right.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
    right.current.y = 0;
    right.current.normalize();

    desired.current.set(0, 0, 0);
    if (keys.forward)  desired.current.add(forward.current);
    if (keys.backward) desired.current.sub(forward.current);
    if (keys.right)    desired.current.add(right.current);
    if (keys.left)     desired.current.sub(right.current);
    if (desired.current.lengthSq() > 0) {
      desired.current.normalize().multiplyScalar(WALK_SPEED * dt);
    }
    desired.current.y -= GRAVITY * dt;

    controller.computeColliderMovement(collider, desired.current);
    const m = controller.computedMovement();
    const t = body.translation();
    const nextX = t.x + m.x;
    const nextY = t.y + m.y;
    const nextZ = t.z + m.z;
    body.setNextKinematicTranslation({ x: nextX, y: nextY, z: nextZ });
    camera.position.set(nextX, nextY + EYE_HEIGHT_OFFSET, nextZ);
    playerPosition.set(nextX, nextY, nextZ);
  });

  return (
    <RigidBody
      ref={rb}
      type="kinematicPosition"
      colliders={false}
      position={SPAWN}
      enabledRotations={[false, false, false]}
    >
      <CapsuleCollider args={[0.6, 0.3]} />
    </RigidBody>
  );
}
