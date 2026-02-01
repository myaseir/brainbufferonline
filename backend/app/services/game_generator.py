import random

def generate_fair_game(total_rounds=20):
    game_rounds = []
    for r in range(1, total_rounds + 1):
        count = min(3 + (r - 1) // 2, 8)
        numbers = random.sample(range(1, 21), count)
        positions = []
        
        for _ in range(count):
            placed = False
            attempts = 0
            while attempts < 500:
                left = round(random.uniform(10, 85), 2)
                top = round(random.uniform(10, 80), 2)
                
                collision = False
                for pos in positions:
                    dx = pos['left'] - left
                    dy = (pos['top'] - top) * 1.5 
                    if (dx**2 + dy**2) < 500:
                        collision = True
                        break
                
                if not collision:
                    positions.append({"left": left, "top": top})
                    placed = True
                    break
                attempts += 1
            
            if not placed:
                positions.append({
                    "left": round(random.uniform(20, 70), 2), 
                    "top": round(random.uniform(20, 70), 2)
                })

        game_rounds.append({
            "round": r, 
            "numbers": numbers, 
            "positions": positions
        })
    return game_rounds