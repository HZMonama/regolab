package main

default allow := false

allow if {
	input.user == "admin"
}
