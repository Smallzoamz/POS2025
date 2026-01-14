
try:
    with open('electron/db_pg.js', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    balance = 0
    main_try_opened = False
    
    for i, line in enumerate(lines):
        val = line.strip()
        
        # Simple brace counting (ignoring comments/strings for speed, assuming formatting is okayish or standard code)
        # To be more robust, we should ignore strings.
        # But let's just do a simple pass first.
        
        # Remove single line comments
        if '//' in val:
            val = val.split('//')[0]
            
        for char in val:
            if char == '{':
                balance += 1
                if i + 1 == 73: # Line 73 in file (0-indexed is 72)
                     # Wait, line 73 in view_file might be different if file changed?
                     # Let's just track balance.
                     pass
            elif char == '}':
                balance -= 1
        
        if i+1 > 635 and i+1 < 655:
             print(f"Line {i+1} : {val} : Balance {balance}")
        pass
        
        if i+1 >= 73:
            if not main_try_opened:
                main_try_opened = True
                print("--- Main Try Started ---")
            
            if balance == 0:
                print(f"!!! Main Try Closed at Line {i+1} !!!")
                break

except Exception as e:
    print(e)
