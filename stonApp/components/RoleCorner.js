import React from 'react';
import { View } from 'react-native';
import { roleColor } from '../utils/roleColors';

export default function RoleCorner({ roles, roleId, size = 17, style }) {
  const color = roleColor(roles, roleId);
  if (!color) return null;
  return <View accessible={false} pointerEvents="none" style={[{
    position: 'absolute', top: 0, right: 0, width: 0, height: 0,
    borderTopWidth: size, borderLeftWidth: size,
    borderTopColor: color, borderLeftColor: 'transparent',
  }, style]} />;
}
