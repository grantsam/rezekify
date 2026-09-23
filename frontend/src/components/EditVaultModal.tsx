import React from 'react';
import { VaultModal, VaultModalProps } from './VaultModal';

export type EditVaultModalProps = VaultModalProps;

export const EditVaultModal: React.FC<EditVaultModalProps> = (props) => (
  <VaultModal {...props} mode="edit" />
);

export default EditVaultModal;

