cmake_minimum_required(VERSION 3.20.0)

find_package(Zephyr REQUIRED HINTS $ENV{ZEPHYR_BASE})
project(led_studio_controller)

target_include_directories(app PRIVATE include)
target_sources(
  app
  PRIVATE
    src/controller_runtime.c
    src/main.c
)
