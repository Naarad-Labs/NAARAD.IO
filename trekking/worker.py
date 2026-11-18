from app import create_app
from jobs import create_celery

celery = create_celery(create_app().config)
