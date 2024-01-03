import asyncio
from asyncio import sleep
from pysui import SuiClient
from pysui.sui.sui_types.transactions import TransactionBlock
from pysui.sui.sui_types.coin import Coin
from pysui.sui.sui_types.utils import from_hex
from pysui.sui.sui_types.keypairs.ed25519 import Ed25519Keypair
from pysui.sui.sui_types.keypairs.ed25519 import Ed25519PublicKey

# Constants
WAIT_INTERVAL_SECONDS = 10
TICK_TYPE = "MOVE"


secret_key = "" # Fill in your private key here
PACKAGE_ID = "0x830fe26674dc638af7c3d84030e2575f44a2bdc1baa1f4757cfe010a4b106b6a"
TICK_RECORD_ID = "0xfa6f8ab30f91a3ca6f969d117677fb4f669e08bbeed815071cf38f4d19284199"
MINT_FEE = 100000000  # 0.1 SUI
TICK = "MOVE"

# Keypair from an existing secret key (bytes)
keypair = Ed25519Keypair.from_secret_key(from_hex(secret_key))
public_key = Ed25519PublicKey(keypair.get_public_key().to_raw_bytes())
MY_ADDRESS = public_key.to_sui_address()
print(f"My address: {MY_ADDRESS}")

# Create a new SuiClient object pointing to the network you want to use
sui_client = SuiClient(url="https://sui-rpc.publicnode.com")

async def get_current_epoch():
    tick_record = await sui_client.get_object(
        id=TICK_RECORD_ID,
        options={"showContent": True, "showDisplay": True},
    )
    return int(tick_record.data["content"]["fields"]["current_epoch"])

async def create_transaction_block():
    txb = TransactionBlock()
    coin = txb.split_coins(txb.gas, [MINT_FEE])[0]

    txb.move_call(
        target=f"{PACKAGE_ID}::movescription::mint",
        arguments=[
            txb.object(TICK_RECORD_ID),
            txb.pure(TICK_TYPE),
            Coin(coin),
            txb.pure("0x6"),
        ],
    )

    return txb

async def wait_for_transaction_result(result):
    transaction_block = await sui_client.wait_for_transaction_block(
        digest=result.digest, options={"showEffects": True}
    )
    return transaction_block

async def execute_transaction():
    latest_epoch = await get_current_epoch()

    while True:
        current_epoch = await get_current_epoch()

        if latest_epoch == current_epoch:
            await sleep(WAIT_INTERVAL_SECONDS)
            continue

        latest_epoch = current_epoch

        try:
            txb = await create_transaction_block()
            result = await sui_client.sign_and_execute_transaction_block(
                transaction_block=txb, signer=keypair
            )
            transaction_block = await wait_for_transaction_result(result)
            print(f"Current epoch: {current_epoch}")

        except Exception as e:
            print(f"An error occurred: {e}")

# Run the asyncio event loop
asyncio.run(execute_transaction())
