
import asyncio
import os
import sys
from typing import List

# Add the backend directory to sys.path to import service
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from services.kinorush_service import search_movies_by_name

async def test_search():
    queries = ["Сказка о царе Салтане", "Дюна 2024", "Голодные игры", "2024"]
    for query in queries:
        print(f"\nSearching for: {query}...")
        results = search_movies_by_name(query)
        if not results:
            print("  No results found.")
            continue
        
        print(f"  Found {len(results)} results:")
        for i, movie in enumerate(results[:5]):
            print(f"    {i+1}. {movie.title} ({movie.year}) - {movie.rating} - {movie.url}")

if __name__ == "__main__":
    asyncio.run(test_search())
