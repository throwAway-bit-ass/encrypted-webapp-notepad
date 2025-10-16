from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import base64
import os

db = SQLAlchemy()

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))  # For authentication only
    public_key = db.Column(db.Text, nullable=False)  # RSA public key
    encrypted_private_key = db.Column(db.Text, nullable=False)  # RSA private key encrypted with user's master key
    salt = db.Column(db.String(32), nullable=False)  # For key derivation
    iv = db.Column(db.String(24), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.relationship('Note', backref='author', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Note(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    encrypted_title = db.Column(db.Text, nullable=False)  # Encrypted title
    encrypted_content = db.Column(db.Text, nullable=False)  # Encrypted content
    encrypted_tags = db.Column(db.Text)  # Encrypted tags
    iv = db.Column(db.String(24), nullable=False)  # Initialization vector for AES
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    tags = db.Column(db.String(500))

    def to_dict(self):
        return {
            'id': self.id,
            'encrypted_title': self.encrypted_title,
            'encrypted_content': self.encrypted_content,
            'encrypted_tags': self.encrypted_tags,
            'iv': self.iv,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'tags': self.tags
        }