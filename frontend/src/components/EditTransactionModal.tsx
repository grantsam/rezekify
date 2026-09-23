import React from 'react';
import { ManualTransactionModal, TransactionModalProps } from './ManualTransactionModal';

export type EditTransactionModalProps = TransactionModalProps;

export const EditTransactionModal: React.FC<EditTransactionModalProps> = (props) => (
  <ManualTransactionModal {...props} mode="edit" />
);

export default EditTransactionModal;

