

# Movie & Book Portal

A simple local web portal for managing a collection of movies and books.

## Features

- View, add, delete movies and books
- Search by title
- Filter by category (movies/books)
- Responsive design with dark theme
- Runs locally on your network

## Installation and Setup

1. Ensure you have Python 3.8+ installed.
2. Navigate to the backend directory: `cd movie-book-portal/backend`
3. Install dependencies: `pip install -r requirements.txt`
4. Start the server: `python -m uvicorn main:app --host 0.0.0.0 --port 5050`
5. Open http://localhost:5050/static/index.html in your browser

Alternatively, run the start script from the project root: `./start.sh` (requires bash on Windows)

## Usage

- Use the "Movies" and "Books" buttons to switch categories
- Add new items using the form at the top
- Search by typing in the search box
- Click "Delete" on any card to remove an item

## API Endpoints

- GET /movies - List all movies
- POST /movies - Add a movie
- DELETE /movies/{id} - Delete a movie
- GET /movies/search?query=... - Search movies
- Similar endpoints for books
- GET /static/index.html - Frontend

## Sample Data

The application includes sample movies and books for testing.
