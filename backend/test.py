import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import random

load_dotenv()

# MongoDB Configuration
MONGO_URL = os.getenv("MONGODB_URL", "mongodb+srv://brainbuffer_admin:Lim3fjQM7zraNjUy@cluster0.ffx3umx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
DB_NAME = "brain_buffer"

async def seed_final_clean_bots():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    users_collection = db.users

    # --- 100 STRICTLY REALISTIC NAMES ---
    bot_names = [
        # --- 10 PUBG / Gamer Style (Kept as requested) ---
        "Sniper_Wolf_PK", "badmash_007", "KILLER_jutt_302", "Ghost_riderPK", "toxic_boy_99",
        "Zalmi_Shooter", "Dark_Soul_1122", "Silent_Hunter", "Agent_47_PK", "Headshot_King",

        # --- 40 Real Boys (Mixed Formatting) ---
        "ali.ahmed_01", "ZainJutt", "bilal_khan_786", "usman.sheikh", "Fahad_Raza99",
        "HamzaTariq", "saad_official", "Ahsan.Jutt", "WaseemButt55", "omer_farooq",
        "daniyal_k", "Sherry_Butt", "mani_cool", "vicky_khan_01", "SunnyJutt",
        "rizwan_ali", "arslan.naseer", "Noman_Ijaz_007", "kashif_m", "Adnan_Sami_90",
        "faizan_raja", "MoizAbbasi", "haris.sohail", "JunaidKhan88", "yasir_shah_pk",
        "zohaib_h", "AdeelCh", "Suhail_A", "kamran_akmal_01", "shoaib_1",
        "RafayBloch", "HashimArain", "farhan_s", "danyal_z", "hassan_ali_55",
        "irtaza_shah", "NaeemB", "Qasim_Ali", "TaimoorKhan", "shehryar_01",
        
        # --- 25 Real Girls (Common & Simple) ---
        "amna_khan_01", "Zainab_Ali", "noor.fatima", "Areeba_99", "Laiba_K",
        "rimsha_ali", "sidra_batool", "Hania_22", "saba_q", "momal_khan",
        "aqsa_javed", "fariha_n", "bisma_ali", "nimra_k", "alishba_01",
        "eman_fatima", "Khadija_B", "ayezah_k", "bushra_12", "sana_y",
        "mehreen_k", "uzma_ali", "sobia_khan", "farwa_batool", "kinza_01",
        
        # --- 25 Short / Nicknames / Castes (Realistic) ---
        "m.ali_99", "sk_khan", "mr_bilal", "just_hamza", "its_zain",
        "hassan_01", "saad_123", "umer_k", "bilal_00", "moiz_11",
        "fahad_786", "sherry_01", "mani_99", "sunny_k", "bobby_khan",
        "Rana_Saif_01", "Ch_Bilal", "Malik_Omer", "Sheikh_Hassan", "Khan_Zain",
        "jutt_ali", "Gujjar_01", "Pathan_007", "Baloch_786", "sindhi_ali"
    ]

    # Ensure exactly 100
    bot_names = bot_names[:100]

    print(f"🚀 Seeding {len(bot_names)} bots (Starting from BOT_021)...")

    # --- Start counting from 21 ---
    for i, name in enumerate(bot_names, 21):
        bot_id = f"BOT_{i:03d}"  # BOT_021 ... BOT_120
        
        bot_doc = {
            "_id": bot_id,
            "username": name,
            "email": f"{bot_id.lower()}@glacialabs.com",
            # Randomize wallet balance to look realistic
            "wallet_balance": float(random.randint(1000, 5000)), 
            "total_matches": random.randint(0, 50),
            "total_wins": random.randint(0, 20),
            "recent_matches": [],
            "is_bot": True,
            "created_at": "2026-02-01T00:00:00Z"
        }

        # Update or Insert
        await users_collection.update_one(
            {"_id": bot_id},
            {"$set": bot_doc},
            upsert=True
        )
        print(f"✅ Seeded: {bot_id} as {name}")

    print(f"\n✨ Done! Added 100 new bots (Total bots in DB: 120).")
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_final_clean_bots())