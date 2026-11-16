"""Phase 3A schema: water_logs, external_product_cache, custom food columns

Revision ID: c7a81e9f0d23
Revises: b4405c1e84d4
Create Date: 2026-11-16 18:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c7a81e9f0d23'
down_revision = 'b4405c1e84d4'
branch_labels = None
depends_on = None


def upgrade():
    # 1. external_product_cache
    op.create_table(
        'external_product_cache',
        sa.Column('barcode', sa.String(length=50), nullable=False),
        sa.Column('source', sa.String(length=50), server_default='openfoodfacts', nullable=False),
        sa.Column('status', sa.Enum('found', 'not_found', name='cache_status_enum'), nullable=False),
        sa.Column('payload', sa.JSON(), nullable=True),
        sa.Column('fetched_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('barcode'),
    )

    # 2. water_logs
    op.create_table(
        'water_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('log_date', sa.Date(), nullable=False),
        sa.Column('amount_ml', sa.Integer(), nullable=False),
        sa.Column('logged_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('water_logs', schema=None) as batch_op:
        batch_op.create_index('ix_water_logs_user_date', ['user_id', 'log_date'], unique=False)

    # 3. foods additions: owner_user_id, diet_verified, needs_review
    with op.batch_alter_table('foods', schema=None) as batch_op:
        batch_op.add_column(sa.Column('owner_user_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('diet_verified', sa.Boolean(), server_default='1', nullable=False))
        batch_op.add_column(sa.Column('needs_review', sa.Boolean(), server_default='0', nullable=False))
        batch_op.create_foreign_key('fk_foods_owner_user', 'users', ['owner_user_id'], ['id'], ondelete='CASCADE')
        batch_op.create_index('ix_foods_owner_user_id', ['owner_user_id'], unique=False)


def downgrade():
    with op.batch_alter_table('foods', schema=None) as batch_op:
        batch_op.drop_index('ix_foods_owner_user_id')
        batch_op.drop_constraint('fk_foods_owner_user', type_='foreignkey')
        batch_op.drop_column('needs_review')
        batch_op.drop_column('diet_verified')
        batch_op.drop_column('owner_user_id')

    with op.batch_alter_table('water_logs', schema=None) as batch_op:
        batch_op.drop_index('ix_water_logs_user_date')
    op.drop_table('water_logs')

    op.drop_table('external_product_cache')
