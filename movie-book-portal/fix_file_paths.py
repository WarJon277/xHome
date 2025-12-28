#!/usr/bin/env python3
"""
Script to fix inconsistent file paths in the databases
"""
import sqlite3
import os

def fix_paths_in_db(db_path, table_name, path_columns):
    """Fix path separators in a specific database table"""
    print(f"Processing {db_path} - table: {table_name}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all records with file paths
    placeholders = ','.join(['?' for _ in path_columns])
    cursor.execute(f"SELECT id, {', '.join(path_columns)} FROM {table_name}")
    rows = cursor.fetchall()
    
    updated_count = 0
    
    for row in rows:
        record_id = row[0]
        paths = row[1:]  # Skip the ID column
        
        updates = []
        values = []
        
        for i, path in enumerate(paths):
            if path is not None and isinstance(path, str):
                # Fix path separators - replace both \ and / with /
                fixed_path = path.replace('\\', '/').replace('//', '/')
                
                # Remove double uploads if present
                if fixed_path.startswith('uploads/uploads/'):
                    fixed_path = fixed_path.replace('uploads/uploads/', 'uploads/', 1)
                elif fixed_path.startswith('/uploads/uploads/'):
                    fixed_path = fixed_path.replace('/uploads/uploads/', '/uploads/', 1)
                
                if fixed_path != path:
                    column_name = path_columns[i]
                    updates.append(f"{column_name} = ?")
                    values.append(fixed_path)
        
        # Update the record if any paths were fixed
        if updates:
            values.append(record_id)  # For WHERE clause
            update_query = f"UPDATE {table_name} SET {', '.join(updates)} WHERE id = ?"
            cursor.execute(update_query, values)
            updated_count += 1
            print(f"  Updated record {record_id}: {dict(zip(path_columns, paths))} -> fixed paths")
    
    conn.commit()
    conn.close()
    
    print(f"  Updated {updated_count} records in {table_name}\n")

def main():
    print("Fixing file paths in databases...\n")
    
    # Fix movies database
    fix_paths_in_db(
        'backend/media_portal.db',
        'movies',
        ['file_path', 'thumbnail_path']
    )
    
    # Fix books database
    fix_paths_in_db(
        'backend/books.db',
        'books',
        ['file_path', 'thumbnail_path']
    )
    
    # Fix tvshows database
    fix_paths_in_db(
        'backend/tvshows.db',
        'tvshows',
        ['file_path', 'thumbnail_path']
    )
    
    # Fix episodes in tvshows database
    fix_paths_in_db(
        'backend/tvshows.db',
        'episodes',
        ['file_path']
    )
    
    print("All databases have been updated successfully!")

if __name__ == "__main__":
    main()