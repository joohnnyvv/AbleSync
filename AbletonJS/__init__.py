from __future__ import absolute_import
import sys

from .AbletonJS import AbletonJS


def create_instance(c_instance):
    return AbletonJS(c_instance)
