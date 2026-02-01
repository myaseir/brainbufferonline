def to_str(val):
    """Safely converts bytes or other types to string without crashing."""
    if val is None:
        return ""
    if isinstance(val, bytes):
        try:
            return val.decode("utf-8")
        except UnicodeDecodeError:
            return str(val)
    return str(val)

def safe_get(d, key_str):
    val = d.get(key_str)
    if val is None:
        val = d.get(key_str.encode()) 
    if isinstance(val, bytes):
        return val.decode()
    return val