import uuid
import pytest
from sqlalchemy import inspect
from rezekify.db.models import User, Transaction, ChatMessage


def test_chat_message_model_fields_and_relationships(db_session, sample_user):
    tx = Transaction(
        user_id=sample_user.id,
        description="Makan siang",
        source_channel="WEB_AI",
    )
    db_session.add(tx)
    db_session.commit()

    msg_user = ChatMessage(
        user_id=sample_user.id,
        role="user",
        content="makan siang 45rb",
    )
    msg_ai = ChatMessage(
        user_id=sample_user.id,
        role="assistant",
        content="✅ Tercatat: Rp 45,000",
        transaction_id=tx.id,
        metadata_json='{"action": "expense"}',
    )
    db_session.add_all([msg_user, msg_ai])
    db_session.commit()

    db_session.refresh(sample_user)
    db_session.refresh(tx)

    assert len(sample_user.chat_messages) == 2
    assert tx.chat_message is not None
    assert tx.chat_message.id == msg_ai.id

    # Test transaction delete sets transaction_id to NULL (ON DELETE SET NULL)
    db_session.delete(tx)
    db_session.commit()

    db_session.refresh(msg_ai)
    assert msg_ai.transaction_id is None
    assert msg_ai.content == "✅ Tercatat: Rp 45,000"
