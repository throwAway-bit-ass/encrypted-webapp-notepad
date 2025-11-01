from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, session
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from models import db, User, Note
from datetime import datetime, timedelta
# Unused 'os' and 'hashlib' imports removed


app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///evernote.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- Consolidated Session Timeout Logic ---
# Single source of truth for session timeout
TIME_TO_LOGOUT_MINUTES = 5

# Session configuration
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=TIME_TO_LOGOUT_MINUTES)
app.config['SESSION_REFRESH_EACH_REQUEST'] = True  # Reset timer on each request

# Initialize extensions
db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.session_protection = 'strong'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Add this to ensure sessions are cleared on server restart
@app.before_request
def make_session_permanent():
    # This ensures the session expires after the configured time
    session.permanent = True
    # FIX: Uses the single TIME_TO_LOGOUT_MINUTES variable
    app.permanent_session_lifetime = timedelta(minutes=TIME_TO_LOGOUT_MINUTES)

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('notes'))
    return render_template('index.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('notes'))

    if request.method == 'GET':
        return render_template('register.html')

    # POST method handling (your existing code)
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    public_key = data.get('public_key')
    encrypted_private_key = data.get('encrypted_private_key')
    salt = data.get('salt')
    iv = data.get('iv')

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 400

    user = User(
        username=username,
        email=email,
        public_key=public_key,
        encrypted_private_key=encrypted_private_key,
        salt=salt,
        iv=iv
    )
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    return jsonify({'message': 'Registration successful'}), 201


@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('notes'))

    if request.method == 'GET':
        return render_template('login.html')

    # Handle login - use JSON to avoid password in logs
    if request.is_json:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
    else:
        # If form data, still process but be careful
        username = request.form.get('username')
        password = request.form.get('password')

    user = User.query.filter_by(username=username).first()

    if user and user.check_password(password):
        login_user(user, remember=False)

        if request.is_json:
            return jsonify({'message': 'Login successful'}), 200
        else:
            flash('Login successful!')
            next_page = request.args.get('next')
            return redirect(next_page or url_for('notes'))
    else:
        if request.is_json:
            return jsonify({'error': 'Invalid username or password'}), 401
        else:
            flash('Invalid username or password')
            return render_template('login.html')

@app.route('/api/user/keys/<username>')
def get_user_keys(username):
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({
        'encrypted_private_key': user.encrypted_private_key,
        'salt': user.salt,
        'iv': user.iv
    })


@app.route('/logout')
def logout():
    logout_user()
    flash('You have been logged out.')
    return redirect(url_for('index'))

@app.route('/api/session/check')
@login_required
def check_session():
    """Check if the user's session is still valid"""
    return jsonify({'valid': True, 'user': current_user.username})

@app.route('/api/session/refresh', methods=['POST'])
@login_required
def refresh_session():
    """Refresh the session expiry time"""
    # This will automatically refresh the session because of Flask-Login's configuration
    return jsonify({'refreshed': True})

@app.route('/api/session/timeout')
def get_session_timeout():
    """Get the session timeout duration in milliseconds"""
    # FIX: Reports the correct timeout from the single source of truth
    return jsonify({'timeout': TIME_TO_LOGOUT_MINUTES * 60 * 1000})

@app.route('/notes')
@login_required
def notes():
    return render_template('notes.html')


@app.route('/api/notes', methods=['GET'])
@login_required
def get_notes():
    notes = Note.query.filter_by(user_id=current_user.id).order_by(Note.updated_at.desc()).all()
    return jsonify([note.to_dict() for note in notes])


@app.route('/api/notes', methods=['POST'])
@login_required
def create_note():
    data = request.get_json()
    note = Note(
        encrypted_title=data.get('encrypted_title'),
        encrypted_content=data.get('encrypted_content'),
        # FIX: Removed 'encrypted_tags'
        iv=data.get('iv'),
        user_id=current_user.id
    )
    db.session.add(note)
    db.session.commit()
    return jsonify(note.to_dict())


@app.route('/api/notes/<int:note_id>', methods=['GET'])
@login_required
def get_note(note_id):
    note = Note.query.filter_by(id=note_id, user_id=current_user.id).first_or_404()
    return jsonify(note.to_dict())


@app.route('/api/notes/<int:note_id>', methods=['PUT'])
@login_required
def update_note(note_id):
    note = Note.query.filter_by(id=note_id, user_id=current_user.id).first_or_404()
    data = request.get_json()

    # Update encrypted data
    note.encrypted_title = data.get('encrypted_title', note.encrypted_title)
    note.encrypted_content = data.get('encrypted_content', note.encrypted_content)
    # FIX: Removed 'encrypted_tags'
    note.iv = data.get('iv', note.iv)
    note.updated_at = datetime.utcnow()

    db.session.commit()
    return jsonify(note.to_dict())


@app.route('/api/notes/<int:note_id>', methods=['DELETE'])
@login_required
def delete_note(note_id):
    note = Note.query.filter_by(id=note_id, user_id=current_user.id).first_or_404()
    db.session.delete(note)
    db.session.commit()
    return jsonify({'message': 'Note deleted successfully'})


@app.route('/create')
@login_required
def create_note_page():
    # FIX: Renders the new consolidated 'editor.html'
    return render_template('editor.html', note_id=None)


@app.route('/edit/<int:note_id>')
@login_required
def edit_note_page(note_id):
    # FIX: Renders the new consolidated 'editor.html' and passes the note_id
    return render_template('editor.html', note_id=note_id)


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)